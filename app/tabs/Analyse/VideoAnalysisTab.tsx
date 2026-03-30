import React, {useEffect, useState} from 'react';
import {Platform, ScrollView, StyleSheet, View} from 'react-native';
import {Button, Card, MD3Theme, ProgressBar, Text, useTheme} from 'react-native-paper';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import {dispatchAddVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchAddVideoAnalysis';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchDeleteVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchDeleteVideoAnalysis';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchSetVideoAnalysisSeedPreflight} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisSeedPreflight';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetLastAnalysisRate} from '../../redux/settings/dispatch/dispatchSetLastAnalysisRate';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {useSettings} from '../../redux/settings/use/useSettings';
import {deleteVideoAnalysisArtifacts, getVideoAnalysisPreviewPath} from '../../utils/videoAnalysisStorage';
import {EMULATOR_SQUAT_VIDEO_PATH, importVideoAnalysisFromSource, requestVideoReadPermission} from '../../utils/video-analysis-import';
import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {estimateAnalysisProgress, formatRemainingTime} from '../../utils/videoAnalysisProgress';

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.error,
    },
  });

const AnalysisProgressIndicator = ({analysisStartedAtMs, videoDurationMs, lastRate}: {analysisStartedAtMs: number; videoDurationMs: number; lastRate: number | undefined}) => {
  const [now, setNow] = useState(Date.now());
  const theme = useTheme();

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const {progress, estimatedRemainingMs} = estimateAnalysisProgress(analysisStartedAtMs, videoDurationMs, lastRate, now);

  return (
    <View style={styles.progressContainer}>
      <ProgressBar
        testID="video-analysis-progress-bar"
        progress={progress}
        color={theme.colors.primary}
        style={styles.progressBar}
      />
      <Text testID="video-analysis-progress-text" style={styles.progressText}>
        Analyzing… ~{formatRemainingTime(estimatedRemainingMs)} remaining
      </Text>
    </View>
  );
};

const VideoAnalysisTab = () => {
  const navigation = useNavigation<any>();
  const analyses = useAllVideoAnalyses();
  const settings = useSettings();
  const addVideoAnalysis = dispatchAddVideoAnalysis();
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const removeVideoAnalysis = dispatchDeleteVideoAnalysis();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
  const setSeedPreflight = dispatchSetVideoAnalysisSeedPreflight();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const setLastAnalysisRate = dispatchSetLastAnalysisRate();
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [importing, setImporting] = useState(false);
  const nextAnalysisId = analyses.length > 0 ? Math.max(...analyses.map((item) => item.id ?? 0)) + 1 : 1;

  const importFromSource = async (sourceUri: string) => {
    try {
      const outcome = await importVideoAnalysisFromSource({
        analysisId: nextAnalysisId,
        sourceUri,
        addVideoAnalysis,
        setVideoAnalysisStatus,
        setManualSeedFramePath,
        setSeedPreflight,
        attachVideoAnalysisResult,
        setLastAnalysisSecondsPerVideoSecond: setLastAnalysisRate,
      });

      if (outcome === 'awaiting_seed_selection') {
        Toast.show({
          type: 'info',
          text1: 'Seed selection required',
          text2: 'Open the analysis detail and choose the correct detected plate.',
          position: 'top',
        });
      } else if (outcome === 'analysis_started') {
        Toast.show({
          type: 'info',
          text1: 'Analysis running in background',
          text2: 'You can continue using the app. A notification will appear when done.',
          position: 'top',
        });
      } else if (outcome === 'done') {
        Toast.show({
          type: 'info',
          text1: 'Analysis completed',
          text2: 'The video was analyzed automatically and is ready in the list.',
          position: 'top',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'No plate candidate found',
          text2: 'No outer plate was detected at t=0. Try another clip.',
          position: 'top',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Import failed',
        text2: 'Could not import or process the selected video.',
        position: 'top',
      });
    }
  };

  const importFromGallery = async () => {
    try {
      setImporting(true);
      const selectedVideo = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.video],
        copyTo: 'cachesDirectory',
      });
      const sourceUri = selectedVideo.fileCopyUri ?? selectedVideo.uri;
      await importFromSource(sourceUri);
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Toast.show({
          type: 'error',
          text1: 'Import failed',
          text2: 'Could not pick a video from the gallery.',
          position: 'top',
        });
      }
    } finally {
      setImporting(false);
    }
  };

  const importEmulatorSquatVideo = async () => {
    try {
      setImporting(true);
      const hasPermission = await requestVideoReadPermission();
      if (!hasPermission) {
        Toast.show({
          type: 'error',
          text1: 'Permission required',
          text2: 'Storage permission is required to import the emulator video.',
          position: 'top',
        });
        return;
      }

      const exists = await RNFS.exists(EMULATOR_SQUAT_VIDEO_PATH);
      if (!exists) {
        Toast.show({
          type: 'error',
          text1: 'Sample video missing',
          text2: EMULATOR_SQUAT_VIDEO_PATH,
          position: 'top',
        });
        return;
      }

      await importFromSource(EMULATOR_SQUAT_VIDEO_PATH);
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (analysisId?: number, resultPath?: string, localVideoPath?: string) => {
    if (analysisId === undefined) {
      return;
    }
    await deleteVideoAnalysisArtifacts({resultPath, localVideoPath, previewPath: getVideoAnalysisPreviewPath(analysisId)});
    removeVideoAnalysis(analysisId);
  };

  return (
    <View style={[styles.container, themedStyles.background]} testID="video-analysis-screen">
      <Button
        testID="video-analysis-import-button"
        mode="contained"
        onPress={importFromGallery}
        loading={importing}
        disabled={importing}
        style={styles.importButton}
      >
        Import Video
      </Button>
      {Platform.OS === 'android' && (
        <Button
          testID="video-analysis-import-emulator-button"
          mode="outlined"
          onPress={importEmulatorSquatVideo}
          disabled={importing}
          style={styles.importButton}
        >
          Import Emulator Squat Video
        </Button>
      )}
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {analyses.length === 0 && (
          <Card style={styles.card} testID="video-analysis-empty-card">
            <Card.Content>
              <Text>No video analyses yet. Import your first training video.</Text>
            </Card.Content>
          </Card>
        )}
        {analyses.map((analysis) => {
          const isProcessing = analysis.status === VideoAnalysisStatus.PROCESSING;
          const showProgress = isProcessing && analysis.analysisStartedAtMs != null && analysis.videoDurationMs != null && analysis.videoDurationMs > 0;

          return (
            <Card key={analysis.id} style={styles.card} testID={`video-analysis-card-${analysis.id}`}>
              <Card.Title title={`Analysis #${analysis.id}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
              <Card.Content>
                <Text testID={`video-analysis-status-${analysis.id}`}>Status: {analysis.status}</Text>
                {showProgress && (
                  <AnalysisProgressIndicator
                    analysisStartedAtMs={analysis.analysisStartedAtMs!}
                    videoDurationMs={analysis.videoDurationMs!}
                    lastRate={settings.lastAnalysisSecondsPerVideoSecond}
                  />
                )}
                {isProcessing && !showProgress && (
                  <View style={styles.progressContainer}>
                    <ProgressBar testID="video-analysis-progress-bar" indeterminate color={theme.colors.primary} style={styles.progressBar} />
                    <Text testID="video-analysis-progress-text" style={styles.progressText}>Analyzing…</Text>
                  </View>
                )}
                {analysis.error && <Text style={themedStyles.errorText}>Error: {analysis.error}</Text>}
              </Card.Content>
              <Card.Actions>
                <Button
                  testID={`video-analysis-open-${analysis.id}`}
                  onPress={() => {
                    if (analysis.id !== undefined) {
                      navigation.navigate({
                        name: 'VideoAnalysisDetail',
                        params: {analysisId: analysis.id},
                      });
                    }
                  }}
                >
                  Open
                </Button>
                <Button
                  testID={`video-analysis-delete-${analysis.id}`}
                  textColor={theme.colors.error}
                  onPress={() => onDelete(analysis.id, analysis.resultPath, analysis.localVideoPath)}
                >
                  Delete
                </Button>
              </Card.Actions>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  importButton: {
    margin: 10,
  },
  card: {
    marginHorizontal: 10,
    marginBottom: 10,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    borderRadius: 4,
  },
  progressText: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.7,
  },
});

export default VideoAnalysisTab;
