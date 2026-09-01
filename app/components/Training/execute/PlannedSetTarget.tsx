import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, Text, useTheme} from 'react-native-paper';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {describePlannedSet} from '../../../utils/planRange';

interface PlannedSetTargetProps {
  plannedWorkout?: Workout;
  /** 1-based index of the set the user is about to log. */
  nextSetIndex: number;
}

export const resolvePlannedSetForIndex = (sets: WorkoutSet[], nextSetIndex: number): WorkoutSet | undefined => {
  if (sets.length === 0) {
    return undefined;
  }
  const sorted = [...sets].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  // Past the last planned set the target stays on that set instead of vanishing —
  // extra sets are still worked against the same prescription.
  return sorted.find((workoutSet) => (workoutSet.index ?? 0) === nextSetIndex) ?? sorted[sorted.length - 1];
};

/**
 * GH-63: the training screen shows the planned set as a readable target,
 * including a range when the plan defines one. Display only — it never prefills
 * the actual set input and never warns about a deviation.
 */
const PlannedSetTarget = ({plannedWorkout, nextSetIndex}: PlannedSetTargetProps) => {
  const theme = useTheme();
  const plannedSet = resolvePlannedSetForIndex(plannedWorkout?.sets ?? [], nextSetIndex);

  if (plannedSet === undefined) {
    return null;
  }

  return (
    <View
      testID="planned-set-target"
      style={[styles.container, {backgroundColor: withAlpha(theme.colors.primary, 0.08)}]}
    >
      <Icon source="target" size={16} color={theme.colors.primary} />
      <Text testID="planned-set-target-label" variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
        {`Target · Set ${plannedSet.index ?? nextSetIndex}`}
      </Text>
      <Text
        testID="planned-set-target-value"
        variant="labelLarge"
        style={[styles.value, {color: theme.colors.onSurface}]}
        numberOfLines={1}
      >
        {describePlannedSet(plannedSet)}
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
