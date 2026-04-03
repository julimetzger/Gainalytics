import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {Button, Card, Dialog, Portal, Text, useTheme} from 'react-native-paper';
import {TrainingLengthBucket, formatTrainingLength, getTrainingLengthBucketLabel} from '../../utils/training-length-analysis';
import {dispatchEditTrainingTimes} from '../../redux/Training/dispatch/general/dispatchEditTrainingTimes';
import {getTrainingDurationMinutes} from '../../utils/training-times';
import {AccumulationMode} from '../../models/AccumulationMode';
import TrainingTimesFields from '../Training/execute/TrainingTimesFields';

interface TrainingLengthEditDialogProps {
  accumulationMode: AccumulationMode;
  bucket: TrainingLengthBucket | null;
  onDismiss: () => void;
  trainingNameById: Record<number, string>;
}

interface DraftTrainingTimes {
  key: string;
  trainingId?: number;
  name: string;
  start: Date;
  end: Date;
  originalStart: Date;
  originalEnd: Date;
}

const getTrainingName = (trainingId: number | undefined, trainingNameById: Record<number, string>) => {
  if (trainingId === undefined) {
    return 'Completed training';
  }

  return trainingNameById[trainingId] ?? `Training ${trainingId}`;
};

const createDraftTrainings = (bucket: TrainingLengthBucket | null, trainingNameById: Record<number, string>): DraftTrainingTimes[] =>
  bucket?.trainings.map((training) => ({
    key: training.key,
    trainingId: training.trainingId,
    name: getTrainingName(training.trainingId, trainingNameById),
    start: new Date(training.start),
    end: new Date(training.end),
    originalStart: new Date(training.start),
    originalEnd: new Date(training.end),
  })) ?? [];

const TrainingLengthEditDialog = ({accumulationMode, bucket, onDismiss, trainingNameById}: TrainingLengthEditDialogProps) => {
  const theme = useTheme();
  const editTrainingTimes = dispatchEditTrainingTimes();
  const [draftTrainings, setDraftTrainings] = useState<DraftTrainingTimes[]>(() => createDraftTrainings(bucket, trainingNameById));
  const [validationErrors, setValidationErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setDraftTrainings(createDraftTrainings(bucket, trainingNameById));
    setValidationErrors({});
  }, [bucket, trainingNameById]);

  const hasValidationError = useMemo(() => draftTrainings.some((training) => !!validationErrors[training.key]), [draftTrainings, validationErrors]);

  const hasChanges = useMemo(
    () =>
      draftTrainings.some(
        (training) => training.start.getTime() !== training.originalStart.getTime() || training.end.getTime() !== training.originalEnd.getTime(),
      ),
    [draftTrainings],
  );

  const averageDurationLabel = useMemo(() => {
    if (draftTrainings.some((training) => !!validationErrors[training.key])) {
      return 'Invalid time range';
    }

    const durations = draftTrainings
      .map((training) => getTrainingDurationMinutes(training.start, training.end))
      .filter((durationMinutes): durationMinutes is number => durationMinutes !== null);

    if (durations.length !== draftTrainings.length || durations.length === 0) {
      return 'Invalid time range';
    }

    const averageDuration = durations.reduce((sum, durationMinutes) => sum + durationMinutes, 0) / durations.length;
    return formatTrainingLength(averageDuration);
  }, [draftTrainings, validationErrors]);

  const updateTrainingField = useCallback((key: string, field: 'start' | 'end', value: Date) => {
    setDraftTrainings((currentTrainings) =>
      currentTrainings.map((training) => {
        if (training.key !== key) {
          return training;
        }

        return {
          ...training,
          [field]: value,
        };
      }),
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!bucket || hasValidationError) {
      return;
    }

    draftTrainings.forEach((training) => {
      if (
        training.trainingId === undefined ||
        (training.start.getTime() === training.originalStart.getTime() && training.end.getTime() === training.originalEnd.getTime())
      ) {
        return;
      }

      editTrainingTimes(training.trainingId, training.start.getTime(), training.end.getTime());
    });

    onDismiss();
  }, [bucket, draftTrainings, editTrainingTimes, hasValidationError, onDismiss]);

  const handleValidationChange = useCallback((key: string, error: string | null) => {
    setValidationErrors((currentValidationErrors) => {
      if (currentValidationErrors[key] === error) {
        return currentValidationErrors;
      }

      return {
        ...currentValidationErrors,
        [key]: error,
      };
    });
  }, []);

  return (
    <Portal>
      <Dialog visible={bucket !== null} onDismiss={onDismiss} style={styles.dialog} testID="training-length-edit-dialog">
        <Dialog.Title>Edit Training Times</Dialog.Title>
        <Dialog.Content>
          {bucket && (
            <Text style={[styles.bucketLabel, {color: theme.colors.onSurfaceVariant}]} testID="training-length-edit-bucket-label">
              {getTrainingLengthBucketLabel(bucket.startDate, accumulationMode)}
            </Text>
          )}
          <Text style={[styles.summary, {color: theme.colors.onSurfaceVariant}]} testID="training-length-edit-average-duration">
            Live average duration: {averageDurationLabel}
          </Text>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {draftTrainings.map((training) => (
              <Card key={training.key} mode="outlined" style={styles.card}>
                <Card.Content>
                  <TrainingTimesFields
                    title={training.name}
                    start={training.start}
                    end={training.end}
                    onStartChange={(value) => updateTrainingField(training.key, 'start', value)}
                    onEndChange={(value) => updateTrainingField(training.key, 'end', value)}
                    testIDPrefix={`training-length-edit-${training.trainingId ?? training.key}`}
                    onValidationChange={(error) => handleValidationChange(training.key, error)}
                  />
                </Card.Content>
              </Card>
            ))}
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleSave} disabled={!hasChanges || hasValidationError}>
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '90%',
  },
  summary: {
    marginBottom: 8,
  },
  bucketLabel: {
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  card: {
    marginBottom: 12,
  },
});

export default TrainingLengthEditDialog;
