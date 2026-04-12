import React, {useState} from 'react';
import {Dimensions, Platform, ScrollView, StyleSheet} from 'react-native';
import {Button, Card, Dialog, IconButton, Portal, Text, useTheme} from 'react-native-paper';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import Toast from 'react-native-toast-message';
import {dispatchAddVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchAddVideoAnalysis';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchSetVideoAnalysisSeedPreflight} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisSeedPreflight';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetVideoAnalysisMetersPerPixel} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisMetersPerPixel';
import {dispatchLinkVideoAnalysisToWorkout} from '../../redux/VideoAnalysis/dispatch/dispatchLinkVideoAnalysisToWorkout';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {EMULATOR_SQUAT_VIDEO_PATH, importVideoAnalysisFromSource, requestVideoReadPermission} from '../../utils/video-analysis-import';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  workoutId: number;
  setIndex: number;
  exerciseId?: number;
  onLinked?: () => void;
}

const VideoSelectionModal = ({visible, onDismiss, workoutId, setIndex, exerciseId, onLinked}: Props) => {
  const analyses = useAllVideoAnalyses();
  const addVideoAnalysis = dispatchAddVideoAnalysis();
  const setVideoAnalysisStatus = dispatchSetVideoAnalysisStatus();
  const setManualSeedFramePath = dispatchSetVideoAnalysisManualSeedFramePath();
  const setSeedPreflight = dispatchSetVideoAnalysisSeedPreflight();
  const attachVideoAnalysisResult = dispatchAttachVideoAnalysisResult();
  const setMetersPerPixel = dispatchSetVideoAnalysisMetersPerPixel();
  const linkVideoAnalysis = dispatchLinkVideoAnalysisToWorkout();
  const theme = useTheme();
  const [importing, setImporting] = useState(false);
  const screenHeight = Dimensions.get('window').height;

  const nextAnalysisId = analyses.length > 0 ? Math.max(...analyses.map(a => a.id ?? 0)) + 1 : 1;

  const displayAnalyses = exerciseId
    ? analyses.filter(a => !a.exerciseId || a.exerciseId === exerciseId)
    : analyses;

  const doLink = (analysisId: number) => {
    linkVideoAnalysis(analysisId, workoutId, exerciseId, setIndex);
    onLinked?.();
    onDismiss();
  };

  const importFromSource = async (sourceUri: string) => {
    try {
      await importVideoAnalysisFromSource({
        analysisId: nextAnalysisId,
        sourceUri,
        addVideoAnalysis,
        setVideoAnalysisStatus,
        setManualSeedFramePath,
        setSeedPreflight,
        attachVideoAnalysisResult,
        setMetersPerPixel,
      });
      linkVideoAnalysis(nextAnalysisId, workoutId, exerciseId, setIndex);
      onLinked?.();
      onDismiss();
      Toast.show({type: 'info', text1: 'Video linked', text2: 'The imported video has been linked to the set.', position: 'top'});
    } catch {
      Toast.show({type: 'error', text1: 'Import failed', text2: 'Could not import or process the selected video.', position: 'top'});
    }
  };

  const importFromGallery = async () => {
    try {
      setImporting(true);
      const selected = await DocumentPicker.pickSingle({type: [DocumentPicker.types.video], copyTo: 'cachesDirectory'});
      await importFromSource(selected.fileCopyUri ?? selected.uri);
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        Toast.show({type: 'error', text1: 'Import failed', text2: 'Could not pick a video from the gallery.', position: 'top'});
      }
    } finally {
      setImporting(false);
    }
  };

  const importEmulatorSquatVideo = async () => {
    try {
      setImporting(true);
      if (!(await requestVideoReadPermission())) {
        Toast.show({type: 'error', text1: 'Permission required', text2: 'Storage permission is required to import the emulator video.', position: 'top'});
        return;
      }
      if (!(await RNFS.exists(EMULATOR_SQUAT_VIDEO_PATH))) {
        Toast.show({type: 'error', text1: 'Sample video missing', text2: EMULATOR_SQUAT_VIDEO_PATH, position: 'top'});
        return;
      }
      await importFromSource(EMULATOR_SQUAT_VIDEO_PATH);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Portal>
      <Dialog style={{maxHeight: screenHeight * 0.9}} visible={visible} onDismiss={onDismiss} testID="video-selection-modal">
        <Dialog.Title>Select Video</Dialog.Title>
        <Dialog.Content>
          <Button
            mode="contained"
            onPress={importFromGallery}
            loading={importing}
            disabled={importing}
            style={styles.importButton}
            testID="video-selection-import-gallery"
          >
            Import Video
          </Button>
          {Platform.OS === 'android' && (
            <Button
              mode="outlined"
              onPress={importEmulatorSquatVideo}
              disabled={importing}
              style={styles.importButton}
              testID="video-selection-import-emulator"
            >
              Import Emulator Squat Video
            </Button>
          )}
          <ScrollView style={{maxHeight: screenHeight * 0.55}}>
            {displayAnalyses.length === 0 && (
              <Text style={styles.emptyText}>No videos available. Import a training video.</Text>
            )}
            {displayAnalyses.map(analysis => {
              const isLinked = !!analysis.workoutId;
              return (
                <Card key={analysis.id} style={styles.card} testID={`video-selection-card-${analysis.id}`}>
                  <Card.Title title={`Analysis #${analysis.id}`} subtitle={new Date(analysis.createdAt).toLocaleString()} />
                  <Card.Content>
                    <Text testID={`video-selection-status-${analysis.id}`}>Status: {analysis.status}</Text>
                    {isLinked && <Text style={{color: theme.colors.secondary}}>Linked to workout {analysis.workoutId}, set {analysis.setIndex ?? '-'}</Text>}
                  </Card.Content>
                  {!isLinked && (
                    <Card.Actions>
                      <Button testID={`video-selection-link-${analysis.id}`} onPress={() => doLink(analysis.id!)}>
                        Link
                      </Button>
                    </Card.Actions>
                  )}
                </Card>
              );
            })}
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <IconButton icon="close" onPress={onDismiss} />
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  importButton: {
    marginBottom: 10,
  },
  card: {
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
  },
});

export default VideoSelectionModal;
