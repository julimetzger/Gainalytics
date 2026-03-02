import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Card, Text, useTheme} from 'react-native-paper';
import DocumentPicker from 'react-native-document-picker';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import {dispatchAddVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchAddVideoAnalysis';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchDeleteVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchDeleteVideoAnalysis';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {
  buildStubBarTrackingResult,
  copyImportedVideoToLocalStorage,
  deleteVideoAnalysisArtifacts,
  writeBarTrackingResultToFile,
} from '../../utils/videoAnalysisStorage';

interface Props {}

const VideoAnalysisTab = ({}: Props) => {
  const navigation = useNavigation<any>();
  const analyses = useAllVideoAnalyses();
  const addVideoAnalysis = dispatchAddVideoAnalysis();
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const removeVideoAnalysis = dispatchDeleteVideoAnalysis();
  const theme = useTheme();
  const [importing, setImporting] = useState(false);

  const importFromGallery = async () => {
    let createdAnalysisId: number | undefined;

    try {
      setImporting(true);
      const selectedVideo = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.video],
        copyTo: 'cachesDirectory',
      });
      const nextId = analyses.length > 0 ? Math.max(...analyses.map((item) => item.id ?? 0)) + 1 : 1;
      const sourceUri = selectedVideo.fileCopyUri ?? selectedVideo.uri;

      addVideoAnalysis({
        id: nextId,
        sourceUri,
        createdAt: new Date(Date.now()),
        status: VideoAnalysisStatus.QUEUED,
        videoMeta: {
          durationMs: 0,
          fps: 0,
          width: 0,
          height: 0,
        },
      });
      createdAnalysisId = nextId;

      setVideoAnalysisStatus(nextId, VideoAnalysisStatus.PROCESSING);
      const localVideoPath = await copyImportedVideoToLocalStorage(sourceUri, nextId);
      const resultPath = await writeBarTrackingResultToFile(buildStubBarTrackingResult(nextId));
      attachVideoAnalysisResult(nextId, resultPath, localVideoPath);

      Toast.show({
        type: 'success',
        text1: 'Video imported',
        text2: 'Stub result generated. Native bar tracking will replace this next.',
        position: 'top',
      });
    } catch (error) {
      if (!DocumentPicker.isCancel(error) && createdAnalysisId !== undefined) {
        setVideoAnalysisStatus(createdAnalysisId, VideoAnalysisStatus.FAILED, 'Import or preprocessing failed');
        Toast.show({
          type: 'error',
          text1: 'Import failed',
          text2: 'Could not import or process the selected video.',
          position: 'top',
        });
      }
    } finally {
      setImporting(false);
    }
  };

  const onDelete = async (analysisId?: number, resultPath?: string, localVideoPath?: string) => {
    if (analysisId === undefined) {
      return;
    }
    await deleteVideoAnalysisArtifacts({resultPath, localVideoPath});
    removeVideoAnalysis(analysisId);
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Button mode="contained" onPress={importFromGallery} loading={importing} disabled={importing} style={styles.importButton}>
        Import Video
      </Button>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {analyses.length === 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text>No video analyses yet. Import your first training video.</Text>
            </Card.Content>
          </Card>
        )}
        {analyses.map((analysis) => (
          <Card key={analysis.id} style={styles.card}>
            <Card.Title title={`Analysis #${analysis.id}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
            <Card.Content>
              <Text>Status: {analysis.status}</Text>
              {analysis.error && <Text style={{color: theme.colors.error}}>Error: {analysis.error}</Text>}
            </Card.Content>
            <Card.Actions>
              <Button
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
              <Button textColor={theme.colors.error} onPress={() => onDelete(analysis.id, analysis.resultPath, analysis.localVideoPath)}>
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
});

export default VideoAnalysisTab;
