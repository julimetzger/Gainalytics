import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Modal, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import RNFS from 'react-native-fs';
import {Button, Card, Divider, MD3Theme, Text, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {BarTrackingResult, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysis} from '../../redux/VideoAnalysis/use/useVideoAnalysis';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {getVideoAnalysisPreviewPath, readBarTrackingResultFromFile} from '../../utils/videoAnalysisStorage';
import VideoAnalysisPlaybackOverlayCard from '../../components/video/VideoAnalysisPlaybackOverlayCard';
import VideoAnalysisManualSeedCard from '../../components/video/VideoAnalysisManualSeedCard';
import VelocityLossBarChart from '../../components/video/VelocityLossBarChart';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchSetVideoAnalysisMetersPerPixel} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisMetersPerPixel';
import {ManualSeedPayload, analyzeSquatVideo, migrateBarTrackingResultIfNeeded} from '../../utils/videoAnalysisNative';
import {calibrateFromSeed} from '../../utils/video-analysis-import';

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
  const [result, setResult] = useState<BarTrackingResult | undefined>();
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [previewDimensions, setPreviewDimensions] = useState<PreviewDimensions>(DEFAULT_PREVIEW_DIMENSIONS);
  const [manualSeedRunning, setManualSeedRunning] = useState(false);

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
      }
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [analysis?.id, analysis?.manualSeedFramePath, analysis?.resultPath]);

  const runManualSeedAnalysis = useCallback(
    async (manualSeed: ManualSeedPayload) => {
      if (!analysis?.id || !analysis.localVideoPath) {
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

        const resultPath = await analyzeSquatVideo(analysis.localVideoPath, analysis.id, manualSeed);
        attachVideoAnalysisResult(analysis.id, resultPath, analysis.localVideoPath);
        setManualSeedFramePath(analysis.id, undefined);
      } catch (error) {
        setVideoAnalysisStatus(analysis.id, VideoAnalysisStatus.FAILED, 'Seeded analysis failed');
      } finally {
        setManualSeedRunning(false);
      }
    },
    [analysis?.id, analysis?.localVideoPath, analysis?.seedFrameWidthPx, attachVideoAnalysisResult, setManualSeedFramePath, setMetersPerPixel, setVideoAnalysisStatus],
  );

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
                <TouchableOpacity
                  key={a.id}
                  testID={`compare-picker-item-${a.id}`}
                  style={[styles.modalItem, {borderBottomColor: theme.colors.outlineVariant}]}
                  onPress={() => onSelectCompare(a.id!)}
                >
                  <Text style={styles.modalItemTitle}>{`Analysis #${a.id}`}</Text>
                  <Text style={styles.modalItemSubtitle}>{new Date(a.createdAt).toLocaleString()}</Text>
                  {a.setResult && (
                    <Text style={styles.modalItemMeta}>
                      {`${a.setResult.repResults.length} reps${a.setResult.velocityLossPercent !== null ? ` | VL ${a.setResult.velocityLossPercent}%` : ''}`}
                    </Text>
                  )}
                </TouchableOpacity>
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
        <Card.Title title={`Analysis #${analysis.id}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
        <Card.Content>
          <Text testID="video-analysis-detail-status">Status: {analysis.status}</Text>
          <Text>Source: {analysis.sourceUri}</Text>
          {analysis.localVideoPath && <Text>Local Video: {analysis.localVideoPath}</Text>}
          {analysis.error && <Text style={themedStyles.errorText}>Error: {analysis.error}</Text>}
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

      <Card style={styles.card}>
        <Card.Title title="Playback Overlay" />
        <Card.Content>
          {!analysis.localVideoPath && <Text>No local video path available yet.</Text>}
          {analysis.localVideoPath && !result && <Text>No analysis result available yet.</Text>}
          {analysis.localVideoPath && result && (
            <VideoAnalysisPlaybackOverlayCard
              key={`${analysis.id}-${analysis.localVideoPath}`}
              analysisId={analysis.id!}
              localVideoPath={analysis.localVideoPath}
              result={result}
              savedSetResult={analysis.setResult}
              metersPerPixel={analysis.metersPerPixel}
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
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalItemTitle: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalItemSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  modalItemMeta: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  modalCancel: {
    marginTop: 12,
  },
});

export default VideoAnalysisDetailTab;
