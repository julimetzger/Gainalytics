import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Dialog, Portal, Text} from 'react-native-paper';
import {Training} from '../../../models/entities/Training';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {TrainingsState} from '../../../models/TrainingsState';
import {getDateTimeStringFromDate} from '../../../utils/DateHelper';
import {dispatchEditTrainingTimes} from '../../../redux/Training/dispatch/general/dispatchEditTrainingTimes';
import ExecuteTraining from './ExecuteTraining';
import TrainingTimesFields from './TrainingTimesFields';

interface EditTrainingProps {
  training: Training;
  chosenExercise: Exercise;
  onSubmit: () => void;
  onSubmitSet?: (workoutSet: WorkoutSet) => void;
}

const toDraftTimes = (training: Training) => {
  const fallbackStart = new Date(training.start ?? training.end ?? Date.now());
  const fallbackEnd = new Date(training.end ?? training.start ?? Date.now());

  return {
    start: fallbackStart,
    end: fallbackEnd,
  };
};

const EditTraining = ({training, chosenExercise, onSubmit, onSubmitSet}: EditTrainingProps) => {
  const editTrainingTimes = dispatchEditTrainingTimes();
  const [draftStart, setDraftStart] = useState(() => toDraftTimes(training).start);
  const [draftEnd, setDraftEnd] = useState(() => toDraftTimes(training).end);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [trainingTimesError, setTrainingTimesError] = useState<string | null>(null);

  useEffect(() => {
    const nextDraftTimes = toDraftTimes(training);
    setDraftStart(nextDraftTimes.start);
    setDraftEnd(nextDraftTimes.end);
  }, [training.end, training.start]);

  const hasChanges = useMemo(() => {
    if (training.start == null || training.end == null) {
      return true;
    }

    return new Date(training.start).getTime() !== draftStart.getTime() || new Date(training.end).getTime() !== draftEnd.getTime();
  }, [draftEnd, draftStart, training.end, training.start]);
  const currentTimeLabel = useMemo(() => `${getDateTimeStringFromDate(draftStart)} - ${getDateTimeStringFromDate(draftEnd)}`, [draftEnd, draftStart]);

  const resetDraftTimes = useCallback(() => {
    const nextDraftTimes = toDraftTimes(training);
    setDraftStart(nextDraftTimes.start);
    setDraftEnd(nextDraftTimes.end);
    setTrainingTimesError(null);
  }, [training.end, training.start]);

  const handleOpenTrainingTimesDialog = useCallback(() => {
    resetDraftTimes();
    setDialogVisible(true);
  }, [resetDraftTimes]);

  const handleDismissTrainingTimesDialog = useCallback(() => {
    resetDraftTimes();
    setDialogVisible(false);
  }, [resetDraftTimes]);

  const handleSaveTrainingTimes = useCallback(() => {
    if (!training.id || trainingTimesError) {
      return;
    }

    editTrainingTimes(training.id, draftStart.getTime(), draftEnd.getTime());
    setDialogVisible(false);
  }, [draftEnd, draftStart, editTrainingTimes, training.id, trainingTimesError]);

  return (
    <View>
      {training.state === TrainingsState.FINISHED && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Training Times</Text>
            <Button mode="outlined" style={styles.openButton} onPress={handleOpenTrainingTimesDialog} testID="edit-training-open-times-modal">
              {currentTimeLabel}
            </Button>
          </Card.Content>
        </Card>
      )}
      <ExecuteTraining training={training} chosenExercise={chosenExercise} onSubmit={onSubmit} onSubmitSet={onSubmitSet} />
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={handleDismissTrainingTimesDialog} testID="edit-training-times-dialog">
          <Dialog.Title>Edit Training Times</Dialog.Title>
          <Dialog.Content>
            <TrainingTimesFields
              title="Completed Training"
              start={draftStart}
              end={draftEnd}
              onStartChange={setDraftStart}
              onEndChange={setDraftEnd}
              testIDPrefix="edit-training-times"
              onValidationChange={setTrainingTimesError}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDismissTrainingTimesDialog}>Cancel</Button>
            <Button onPress={handleSaveTrainingTimes} disabled={!training.id || !hasChanges || !!trainingTimesError} testID="edit-training-times-save">
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 12,
  },
  openButton: {
    marginTop: 12,
  },
});

export default EditTraining;
