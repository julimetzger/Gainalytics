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
import {dispatchSetVideoAnalysisDuration} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisDuration';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {deleteVideoAnalysisArtifacts, getVideoAnalysisPreviewPath} from '../../utils/videoAnalysisStorage';
import {EMULATOR_SQUAT_VIDEO_PATH, importVideoAnalysisFromSource, requestVideoReadPermission} from '../../utils/video-analysis-import';
import {calculateAnalysisProgress} from '../../utils/videoAnalysisProgress';
import {estimateAnalysisTimeMs} from '../../utils/videoAnalysisNotification';

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.background,
    },
    errorText: {
      color: theme.colors.error,
    },
  });

// Module-level map so start times survive navigation (component unmount/remount).
const _analysisStartTimes = new Map<number, number>();

const VideoAnalysisTab = () => {
  const navigation = useNavigation<any>();
  const analyses = useAllVideoAnalyses();
  const addVideoAnalysis = dispatchAddVideoAnalysis();
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const removeVideoAnalysis = dispatchDeleteVideoAnalysis();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
  const setSeedPreflight = dispatchSetVideoAnalysisSeedPreflight();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const setVideoAnalysisDuration = dispatchSetVideoAnalysisDuration();
  const theme = useTheme();
  const themedStyles = createThemedStyles(theme);
  const [importing, setImporting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [lastSecondsPerVideoSecond, setLastSecondsPerVideoSecond] = useState(1.0);
  const nextAnalysisId = analyses.length > 0 ? Math.max(...analyses.map((item) => item.id ?? 0)) + 1 : 1;

  // Refresh every 500ms while any analysis is in PROCESSING state so the
  // progress bar advances smoothly.
  const processingCount = analyses.filter((a) => a.status === VideoAnalysisStatus.PROCESSING).length;
  useEffect(() => {
    if (processingCount === 0) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [processingCount]);

  const importFromSource = async (sourceUri: string) => {
    const currentAnalysisId = nextAnalysisId;
    _analysisStartTimes.set(currentAnalysisId, Date.now());
    try {
      const outcome = await importVideoAnalysisFromSource({
        analysisId: currentAnalysisId,
        sourceUri,
        addVideoAnalysis,
        setVideoAnalysisStatus,
        setVideoAnalysisDuration,
        setManualSeedFramePath,
        setSeedPreflight,
        attachVideoAnalysisResult,
      });

      if (outcome === 'done') {
        // Update learned analysis speed for future progress estimates.
        const startTime = _analysisStartTimes.get(currentAnalysisId);
        const analysis = analyses.find((a) => a.id === currentAnalysisId);
        const videoDurationMs = analysis?.videoMeta?.durationMs ?? 0;
        if (startTime !== undefined && videoDurationMs > 0) {
          const elapsedSec = (Date.now() - startTime) / 1000;
          const videoDurationSec = videoDurationMs / 1000;
          setLastSecondsPerVideoSecond(elapsedSec / videoDurationSec);
        }
      }

      if (outcome === 'awaiting_seed_selection') {
        Toast.show({
          type: 'info',
          text1: 'Seed selection required',
          text2: 'Open the analysis detail and choose the correct detected plate.',
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
        {analyses.map((analysis) => (
          <Card key={analysis.id} style={styles.card} testID={`video-analysis-card-${analysis.id}`}>
            <Card.Title title={`Analysis #${analysis.id}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
            <Card.Content>
              <Text testID={`video-analysis-status-${analysis.id}`}>Status: {analysis.status}</Text>
              {analysis.status === VideoAnalysisStatus.PROCESSING && analysis.id !== undefined && (
                <ProgressBar
                  testID={`video-analysis-progress-${analysis.id}`}
                  indeterminate={!analysis.videoMeta?.durationMs}
                  progress={
                    analysis.videoMeta?.durationMs
                      ? calculateAnalysisProgress(
                          now - (_analysisStartTimes.get(analysis.id) ?? now),
                          estimateAnalysisTimeMs(analysis.videoMeta.durationMs, lastSecondsPerVideoSecond),
                        )
                      : undefined
                  }
                  style={styles.progressBar}
                />
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
        ))}
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
  progressBar: {
    marginTop: 8,
    height: 8,
  },
});

export default VideoAnalysisTab;
