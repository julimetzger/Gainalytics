import React, {useState} from 'react';
import {useStore} from 'react-redux';
import {StyleSheet} from 'react-native';
import {Button, Card, Text, useTheme} from 'react-native-paper';
import EditDialogScaffold from '../common/EditDialogScaffold';
import Toast from 'react-native-toast-message';
import {GlobalState} from '../../redux/rootReducer';
import {dispatchAddVideoAnalysis} from '../../redux/VideoAnalysis/dispatch/dispatchAddVideoAnalysis';
import {dispatchSetVideoAnalysisStatus} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisStatus';
import {dispatchSetVideoAnalysisManualSeedFramePath} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisManualSeedFramePath';
import {dispatchSetVideoAnalysisSeedPreflight} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisSeedPreflight';
import {dispatchAttachVideoAnalysisResult} from '../../redux/VideoAnalysis/dispatch/dispatchAttachVideoAnalysisResult';
import {dispatchSetVideoAnalysisMetersPerPixel} from '../../redux/VideoAnalysis/dispatch/dispatchSetVideoAnalysisMetersPerPixel';
import {dispatchLinkVideoAnalysisToWorkout} from '../../redux/VideoAnalysis/dispatch/dispatchLinkVideoAnalysisToWorkout';
import {useAllVideoAnalyses} from '../../redux/VideoAnalysis/use/useAllVideoAnalyses';
import {importVideoAnalysisFromSource} from '../../utils/video-analysis-import';
import {pickVideoFromGallery} from '../../utils/videoAnalysisNative';

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
  const store = useStore<GlobalState>();
  const [importing, setImporting] = useState(false);

  const showToast = (params: Parameters<typeof Toast.show>[0]) => {
    if (!store.getState().settings?.toggles?.disableToasts) {
      Toast.show(params);
    }
  };

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
      showToast({type: 'info', text1: 'Video linked', text2: 'The imported video has been linked to the set.', position: 'top'});
    } catch {
      showToast({type: 'error', text1: 'Import failed', text2: 'Could not import or process the selected video.', position: 'top'});
    }
  };

  const importFromGallery = async () => {
    try {
      setImporting(true);
      const picked = await pickVideoFromGallery();
      if (!picked) {
        return;
      }
      await importFromSource(picked.uri);
    } catch (_e) {
      showToast({type: 'error', text1: 'Import failed', text2: 'Could not pick a video from the gallery.', position: 'top'});
    } finally {
      setImporting(false);
    }
  };

  return (
    <EditDialogScaffold
      visible={visible}
      onDismiss={onDismiss}
      title="Select Video"
      testID="video-selection-modal"
      dismissTestID="video-selection-close"
      scrollable
    >
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
    </EditDialogScaffold>
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
