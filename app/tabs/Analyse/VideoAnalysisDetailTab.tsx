import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Modal, ScrollView, StyleSheet, View} from 'react-native';
import RNFS from 'react-native-fs';
import {Button, Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarTrackingResult, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {useVideoAnalysisSetIdentity} from '../../redux/VideoAnalysis/use/useVideoAnalysisSetIdentity';
import {useVideoAnalysisExerciseId} from '../../redux/VideoAnalysis/use/useVideoAnalysisExerciseId';
import {useExerciseVlReference} from '../../redux/Exercises/use/useExerciseVlReference';
import {getVideoAnalysisPreviewPath, readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';
import CompareAnalysisPickerItem from '../../components/video/CompareAnalysisPickerItem';
import VideoAnalysisPlaybackOverlayCard from '../../components/video/VideoAnalysisPlaybackOverlayCard';
import VideoAnalysisManualSeedCard from '../../components/video/VideoAnalysisManualSeedCard';
import VlReferenceCard from '../../components/video/VlReferenceCard';
import VelocityLossBarChart from '../../components/video/VelocityLossBarChart';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchSetVideoAnalysisMetersPerPixel} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisMetersPerPixel';
import {dispatchSetVideoAnalysisLocalVideoPath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisLocalVideoPath';
import {
  ManualSeedPayload,
  analyzeSquatVideo,
  copyVideoToAppStorage,
  isVideoSourceAvailable,
  migrateBarTrackingResultIfNeeded,
} from '../../utils/videoAnalysisNative';
import {isVideoSecuredInApp, resolveVideoPlaybackUri} from '../../utils/videoAnalysisSource';
import {calibrateFromSeed} from '../../utils/video-analysis-import';
import Toast from 'react-native-toast-message';

interface Props extends NativeStackScreenProps<RootStackParamList, 'VideoAnalysisDetail'> {}

interface PreviewDimensions {
  width: number;
  height: number;
}

const DEFAULT_PREVIEW_DIMENSIONS: PreviewDimensions = {width: 1600, height: 900};

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.error,
    },
  });

const VideoAnalysisDetailTab = ({route}: Props) => {
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const navigation = useNavigation<any>();
  const analysis = useVideoAnalysis(route.params.analysisId);
  const allAnalyses = useAllVideoAnalyses();
  const analysisIdentity = useVideoAnalysisSetIdentity(analysis);
  const exerciseId = useVideoAnalysisExerciseId(analysis);
  const vlReference = useExerciseVlReference(exerciseId);
  const [showComparePicker, setShowComparePicker] = useState(false);

  const compareTargets = useMemo(() => {
    const currentId = analysis?.id;
    const currentExerciseId = analysis?.exerciseId;
    return allAnalyses.filter((a) => {
      if (a.id === currentId) {
        return false;
      }
      if (a.status !== VideoAnalysisStatus.DONE) {
        return false;
      }
      // Prefer same exercise; if no exercise link, show all DONE analyses
      if (currentExerciseId != null && a.exerciseId != null) {
        return a.exerciseId === currentExerciseId;
      }
      return true;
    });
  }, [allAnalyses, analysis?.id, analysis?.exerciseId]);

  const onSelectCompare = useCallback(
    (compareId: number) => {
      setShowComparePicker(false);
      navigation.navigate('VideoAnalysisCompare', {
        analysisId: analysis!.id!,
        compareAnalysisId: compareId,
      });
    },
    [navigation, analysis],
  );
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
  const setMetersPerPixel = dispatchSetVideoAnalysisMetersPerPixel();
  const setLocalVideoPath = dispatchSetVideoAnalysisLocalVideoPath();
  const [result, setResult] = useState<BarTrackingResult | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [previewDimensions, setPreviewDimensions] = useState<PreviewDimensions>(DEFAULT_PREVIEW_DIMENSIONS);
  const [manualSeedRunning, setManualSeedRunning] = useState(false);
  const [securingVideo, setSecuringVideo] = useState(false);
  const playbackUri = resolveVideoPlaybackUri(analysis);
  const videoSecured = isVideoSecuredInApp(analysis);
  // Undefined while the probe is in flight — don't disable the button on a guess.
  const [sourceAvailable, setSourceAvailable] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!playbackUri) {
      setSourceAvailable(false);
      return;
    }
    let cancelled = false;
    setSourceAvailable(undefined);
    isVideoSourceAvailable(playbackUri).then((available) => {
      if (!cancelled) {
        setSourceAvailable(available);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [playbackUri]);

  // A vanished gallery video can no longer be pulled into the app.
  const canSecureVideo = !videoSecured && sourceAvailable !== false;

  useEffect(() => {
    let active = true;

    const loadResult = async () => {
      if (!analysis?.resultPath || analysis.status !== VideoAnalysisStatus.DONE) {
        if (active) {
          setResult(undefined);
        }
        return;
      }

      const migratedResultPath = await migrateBarTrackingResultIfNeeded(analysis.resultPath);
      const loadedResult = await readBarTrackingResultFromFile(migratedResultPath ?? analysis.resultPath);
      if (active) {
        setResult(loadedResult);
      }
    };

    loadResult();
    return () => {
      active = false;
    };
  }, [analysis?.createdAt, analysis?.id, analysis?.localVideoPath, analysis?.resultPath, analysis?.status]);

  useEffect(() => {
    let active = true;
    const loadPreview = async () => {
      if (analysis?.id === undefined) {
        setPreviewUri(undefined);
        setPreviewDimensions(DEFAULT_PREVIEW_DIMENSIONS);
        return;
      }

      const previewPath = analysis.manualSeedFramePath ?? getVideoAnalysisPreviewPath(analysis.id);
      const exists = await RNFS.exists(previewPath);
      if (active) {
        if (!exists) {
          setPreviewUri(undefined);
          setPreviewDimensions(DEFAULT_PREVIEW_DIMENSIONS);
          return;
        }

        const uri = `file://${previewPath}`;
        setPreviewUri(uri);
        if (analysis.seedFrameWidthPx && analysis.seedFrameHeightPx) {
          setPreviewDimensions({width: analysis.seedFrameWidthPx, height: analysis.seedFrameHeightPx});
        }
      }
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [analysis?.id, analysis?.manualSeedFramePath, analysis?.resultPath, analysis?.seedFrameWidthPx, analysis?.seedFrameHeightPx]);

  const runManualSeedAnalysis = useCallback(
    async (manualSeed: ManualSeedPayload) => {
      // Gallery-backed analyses have no localVideoPath — re-seed against the source URI.
      const videoUri = resolveVideoPlaybackUri(analysis);
      if (!analysis?.id || !videoUri) {
        return;
      }

      try {
        setManualSeedRunning(true);
        setVideoAnalysisStatus(analysis.id, VideoAnalysisStatus.PROCESSING);

        // Calculate metersPerPixel from known plate diameter and detected plate width.
        const mpp = calibrateFromSeed(manualSeed.normalizedWidth, analysis.seedFrameWidthPx ?? 0);
        if (mpp != null) {
          setMetersPerPixel(analysis.id, mpp);
        }

        const resultPath = await analyzeSquatVideo(videoUri, analysis.id, manualSeed);
        attachVideoAnalysisResult(analysis.id, resultPath, analysis.localVideoPath);
        setManualSeedFramePath(analysis.id, undefined);
      } catch (error) {
        setVideoAnalysisStatus(analysis.id, VideoAnalysisStatus.FAILED, 'Seeded analysis failed');
      } finally {
        setManualSeedRunning(false);
      }
    },
    [analysis, attachVideoAnalysisResult, setManualSeedFramePath, setMetersPerPixel, setVideoAnalysisStatus],
  );

  const onSecureVideo = useCallback(async () => {
    const videoUri = resolveVideoPlaybackUri(analysis);
    if (!analysis?.id || !videoUri || isVideoSecuredInApp(analysis)) {
      return;
    }

    try {
      setSecuringVideo(true);
      const localVideoPath = await copyVideoToAppStorage(videoUri, analysis.id);
      setLocalVideoPath(analysis.id, localVideoPath);
      Toast.show({
        type: 'info',
        text1: 'Video secured',
        text2: 'The video is now stored in the app and will be kept.',
        position: 'top',
      });
    } catch (_error) {
      Toast.show({
        type: 'error',
        text1: 'Secure failed',
        text2: 'The source video could not be copied into the app.',
        position: 'top',
      });
    } finally {
      setSecuringVideo(false);
    }
  }, [analysis, setLocalVideoPath]);

  if (!analysis) {
    return (
      <View style={[styles.centered, themedStyles.background]} testID="video-analysis-detail-not-found">
        <Text>Video analysis not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="video-analysis-detail-screen"
      style={[styles.container, themedStyles.background]}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Compare picker modal */}
      <Modal
        visible={showComparePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComparePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, {backgroundColor: theme.colors.surface}]}>
            <Text style={styles.modalTitle}>Select analysis to compare</Text>
            <ScrollView style={styles.modalScroll}>
              {compareTargets.length === 0 && (
                <Text style={styles.modalEmpty}>No other completed analyses available.</Text>
              )}
              {compareTargets.map((a) => (
                <CompareAnalysisPickerItem key={a.id} analysis={a} onPress={() => onSelectCompare(a.id!)} />
              ))}
            </ScrollView>
            <Button
              testID="compare-picker-cancel"
              mode="outlined"
              onPress={() => setShowComparePicker(false)}
              style={styles.modalCancel}
            >
              Cancel
            </Button>
          </View>
        </View>
      </Modal>

      <Card style={styles.card}>
        <Card.Title
          title={analysisIdentity}
          titleNumberOfLines={2}
          subtitle={new Date(analysis.createdAt).toLocaleString()}
        />
        <Card.Content>
          <Text testID="video-analysis-detail-status">Status: {analysis.status}</Text>
          <Text>Source: {analysis.sourceUri}</Text>
          {analysis.localVideoPath && <Text>Local Video: {analysis.localVideoPath}</Text>}
          {analysis.error && <Text style={themedStyles.errorText}>Error: {analysis.error}</Text>}

          {playbackUri && (
            <View style={styles.secureActionsInner}>
              <Button
                testID="video-analysis-secure-video-button"
                mode={videoSecured ? 'outlined' : 'contained'}
                icon={videoSecured ? 'check-circle-outline' : 'download'}
                disabled={!canSecureVideo || securingVideo}
                loading={securingVideo}
                onPress={onSecureVideo}
                style={styles.secureButton}
              >
                {videoSecured ? 'Video secured in app' : 'Secure video in app'}
              </Button>
              <Text testID="video-analysis-secure-video-hint" variant="bodySmall" style={styles.secureHint}>
                {videoSecured
                  ? 'This video is stored in the app and will be kept, even if you delete it from the gallery.'
                  : sourceAvailable === false
                    ? 'The source video is no longer in the gallery and can no longer be imported into the app.'
                    : 'Saves the video into the app. It will then be kept, even if you delete it from the gallery.'}
              </Text>
            </View>
          )}
        </Card.Content>
        {analysis.status === VideoAnalysisStatus.DONE && (
          <Card.Actions>
            <Button
              testID="video-analysis-compare-button"
              mode="outlined"
              onPress={() => setShowComparePicker(true)}
            >
              Compare
            </Button>
          </Card.Actions>
        )}
      </Card>

      <Divider style={styles.divider} />

      {analysis.status === VideoAnalysisStatus.DONE && <VlReferenceCard analysis={analysis} />}

      <Card style={styles.card}>
        <Card.Title title="Playback Overlay" />
        <Card.Content>
          {!playbackUri && <Text>No video source available yet.</Text>}
          {playbackUri && !result && <Text>No analysis result available yet.</Text>}
          {playbackUri && result && (
            <VideoAnalysisPlaybackOverlayCard
              key={`${analysis.id}-${playbackUri}`}
              analysisId={analysis.id!}
              videoUri={playbackUri}
              result={result}
              savedSetResult={analysis.setResult}
              metersPerPixel={analysis.metersPerPixel}
              vlReference={vlReference}
            />
          )}
        </Card.Content>
      </Card>

      {analysis.status === VideoAnalysisStatus.DONE &&
        ((result?.repMetrics?.length ?? 0) > 0 || (analysis.setResult?.repResults?.length ?? 0) > 0) && (
        <Card style={styles.card}>
          <Card.Title title="Rep Velocity Chart" />
          <Card.Content>
            <VelocityLossBarChart
              repMetrics={result?.repMetrics ?? []}
              savedSetResult={analysis.setResult}
              metersPerPixel={analysis.metersPerPixel}
            />
          </Card.Content>
        </Card>
      )}

      {analysis.status === VideoAnalysisStatus.AWAITING_SEED_SELECTION && (
        <VideoAnalysisManualSeedCard
          previewUri={previewUri}
          previewDimensions={previewDimensions}
          busy={manualSeedRunning}
          title="Select Initial Plate"
          subtitle="Choose the correct detected outer plate to start analysis"
          actionLabel="Start Analysis"
          suggestedBoxes={analysis.seedCandidates}
          onRunManualSeedAnalysis={runManualSeedAnalysis}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 10,
  },
  secureActionsInner: {
    marginTop: 12,
  },
  secureButton: {
    alignSelf: 'flex-start',
  },
  secureHint: {
    marginTop: 6,
  },
  divider: {
    marginHorizontal: 10,
    marginVertical: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalEmpty: {
    marginVertical: 20,
    textAlign: 'center',
    opacity: 0.6,
  },
  modalCancel: {
    marginTop: 12,
  },
});

export default VideoAnalysisDetailTab;
