import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {trainingProgress} from '../../../utils/training-progress';
import {formatDurationShort} from '../../../utils/overview-comparison';

interface TrainingActionBarProps {
  exercises: Exercise[];
  /** Completed (finalized) exercises of this training → their logged set count. */
  completedSetCounts: Record<number, number>;
  chosenExerciseId?: number;
  trainingStart?: string | number | Date;
  /** The selected exercise has logged sets that "Next" can complete. */
  hasLoggedSets: boolean;
  onNext: (nextExerciseId: number | undefined) => void;
  onFinish: () => void;
}

/**
 * GH-623: the Train tab's fixed bar above the bottom navigation while a training runs. Mid-training it only
 * moves on ("Next: …", which completes the selected exercise like the former "Add Workout" did); it turns into
 * "Finish Training" once every exercise is completed. Finishing early stays in the ⋮ menu.
 */
const TrainingActionBar = ({exercises, completedSetCounts, chosenExerciseId, trainingStart, hasLoggedSets, onNext, onFinish}: TrainingActionBarProps) => {
  const theme = useTheme();
  const exerciseIds = exercises.map((exercise) => exercise.id).filter((id): id is number => id !== undefined);
  const completedIds = exerciseIds.filter((id) => completedSetCounts[id] !== undefined);
  const progress = trainingProgress(exerciseIds, completedIds, chosenExerciseId);
  const nextExercise = exercises.find((exercise) => exercise.id === progress.nextExerciseId);
  const chosenCompleted = chosenExerciseId !== undefined && completedIds.includes(chosenExerciseId);

  const setCount = completedIds.reduce((sum, id) => sum + completedSetCounts[id], 0);
  const startMs = trainingStart !== undefined ? new Date(trainingStart).getTime() : NaN;
  const duration = Number.isNaN(startMs) ? undefined : formatDurationShort(Date.now() - startMs);
  const progressLabel = progress.allCompleted
    ? [`${progress.total} of ${progress.total} exercises`, `${setCount} ${setCount === 1 ? 'set' : 'sets'}`, duration].filter(Boolean).join(' · ')
    : `Exercise ${progress.currentPosition} of ${progress.total}`;

  return (
    <View testID="train-action-bar" style={[styles.bar, {backgroundColor: theme.colors.elevation?.level2 ?? theme.colors.surface, borderTopColor: theme.colors.outlineVariant}]}>
      <Text testID="train-action-bar-progress" variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
        {progressLabel}
      </Text>
      <View style={styles.segments}>
        {exerciseIds.map((id) => {
          const isCurrent = id === chosenExerciseId;
          const color = completedIds.includes(id) ? theme.colors.primary : isCurrent ? theme.colors.inversePrimary : theme.colors.outlineVariant;
          return <View key={id} testID={`train-action-bar-segment-${id}`} style={[styles.segment, isCurrent && styles.currentSegment, {backgroundColor: color}]} />;
        })}
      </View>
      {progress.allCompleted ? (
        <Button testID="train-tab-finish-button" mode="contained" icon="flag-checkered" buttonColor={theme.colors.primary} textColor={theme.colors.onPrimary} style={styles.button} contentStyle={styles.buttonContent} onPress={onFinish}>
          Finish Training
        </Button>
      ) : (
        <Button
          testID="train-tab-next-button"
          mode="contained"
          icon="arrow-right"
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
          style={styles.button}
          contentStyle={[styles.buttonContent, styles.iconAfterLabel]}
          disabled={nextExercise === undefined && !hasLoggedSets && !chosenCompleted}
          onPress={() => onNext(progress.nextExerciseId)}
        >
          {nextExercise !== undefined ? `Next: ${nextExercise.name}` : 'Complete exercise'}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  segments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  currentSegment: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    alignSelf: 'stretch',
  },
  buttonContent: {
    height: 48,
  },
  iconAfterLabel: {
    flexDirection: 'row-reverse',
  },
});

export default memo(TrainingActionBar);
