import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, Text, useTheme} from 'react-native-paper';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {describePlannedSet} from '../../../utils/planRange';

interface PlannedSetTargetProps {
  plannedWorkout?: Workout;
  /** Indices of the sets the user has actually logged so far. */
  loggedSetIndices: number[];
}

const byIndex = (left: WorkoutSet, right: WorkoutSet) => (left.index ?? 0) - (right.index ?? 0);

/**
 * The first planned set the user has not logged yet.
 *
 * Selection is driven purely by which planned indices are already logged, so it
 * survives plans whose sets do not start at 1 (a plan carries the indices of
 * the workout it was created from) and plans with holes in the numbering (the
 * middle set was deleted). Returns `undefined` once every planned set is done.
 */
export const resolveNextPlannedSet = (sets: WorkoutSet[], loggedSetIndices: number[]): WorkoutSet | undefined => {
  const logged = new Set(loggedSetIndices);
  return [...sets].sort(byIndex).find((workoutSet) => !logged.has(workoutSet.index ?? 0));
};

/**
 * The set number the training screen must show above the input — the same
 * number the target banner names, and the index the submitted set will carry.
 *
 * While planned sets are open that is the next open planned index. Once the
 * plan is worked off, extra sets continue after the highest number in play.
 */
export const resolveNextSetNumber = (sets: WorkoutSet[], loggedSetIndices: number[]): number => {
  const nextPlanned = resolveNextPlannedSet(sets, loggedSetIndices);
  if (nextPlanned?.index !== undefined) {
    return nextPlanned.index;
  }
  const highest = [...loggedSetIndices, ...sets.map((workoutSet) => workoutSet.index ?? 0)].reduce((max, value) => Math.max(max, value), 0);
  return highest + 1;
};

/**
 * GH-63: the training screen shows the planned set as a readable target,
 * including a range when the plan defines one. Display only — it never prefills
 * the actual set input and never warns about a deviation.
 */
const PlannedSetTarget = ({plannedWorkout, loggedSetIndices}: PlannedSetTargetProps) => {
  const theme = useTheme();
  const plannedSets = plannedWorkout?.sets ?? [];
  const plannedSet = resolveNextPlannedSet(plannedSets, loggedSetIndices);

  if (plannedSets.length === 0) {
    return null;
  }

  const done = plannedSet === undefined;

  return (
    <View
      testID="planned-set-target"
      style={[styles.container, {backgroundColor: withAlpha(theme.colors.primary, 0.08)}]}
    >
      <Icon source={done ? 'check-circle-outline' : 'target'} size={16} color={theme.colors.primary} />
      <Text testID="planned-set-target-label" variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
        {done ? 'Target' : `Target · Set ${resolveNextSetNumber(plannedSets, loggedSetIndices)}`}
      </Text>
      <Text
        testID="planned-set-target-value"
        variant="labelLarge"
        style={[styles.value, {color: theme.colors.onSurface}]}
        numberOfLines={1}
      >
        {done ? `All ${plannedSets.length} planned sets logged` : describePlannedSet(plannedSet!)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  value: {
    flexShrink: 1,
  },
});

export default PlannedSetTarget;
