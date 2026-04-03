import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card} from 'react-native-paper';
import {Training} from '../../../models/entities/Training';
import {Exercise} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {dispatchEditTrainingTimes} from '../../../redux/Training/dispatch/general/dispatchEditTrainingTimes';
import {getTrainingTimeValidationError} from '../../../utils/training-times';
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

  useEffect(() => {
    const nextDraftTimes = toDraftTimes(training);
    setDraftStart(nextDraftTimes.start);
    setDraftEnd(nextDraftTimes.end);
  }, [training.end, training.start]);

  const validationError = useMemo(() => getTrainingTimeValidationError(draftStart, draftEnd), [draftEnd, draftStart]);
  const hasChanges = useMemo(
    () => new Date(training.start ?? draftStart).getTime() !== draftStart.getTime() || new Date(training.end ?? draftEnd).getTime() !== draftEnd.getTime(),
    [draftEnd, draftStart, training.end, training.start],
  );

  const handleSaveTrainingTimes = useCallback(() => {
    if (!training.id || validationError) {
      return;
    }

    editTrainingTimes(training.id, draftStart.getTime(), draftEnd.getTime());
  }, [draftEnd, draftStart, editTrainingTimes, training.id, validationError]);

  return (
    <View>
      <Card style={styles.card}>
        <Card.Content>
          <TrainingTimesFields
            title="Training Times"
            start={draftStart}
            end={draftEnd}
            onStartChange={setDraftStart}
            onEndChange={setDraftEnd}
            testIDPrefix="edit-training-times"
          />
          <Button
            mode="contained"
            style={styles.saveButton}
            onPress={handleSaveTrainingTimes}
            disabled={!training.id || !hasChanges || !!validationError}
            testID="edit-training-times-save"
          >
            Save Training Times
          </Button>
        </Card.Content>
      </Card>
      <ExecuteTraining training={training} chosenExercise={chosenExercise} onSubmit={onSubmit} onSubmitSet={onSubmitSet} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 12,
  },
  saveButton: {
    marginTop: 16,
  },
});

export default EditTraining;
