import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {PlanField} from './planTypes';
import {formatPlanNumber, PLAN_CELL_TEST_ID} from './planUtils';

interface PlanReadSetRowProps {
  workoutSet: WorkoutSet;
  onCellPress: (field: PlanField) => void;
  onRowLongPress: () => void;
}

const PlanReadSetRow = ({workoutSet, onCellPress, onRowLongPress}: PlanReadSetRowProps) => {
  const theme = useTheme();

  return (
    <Pressable onLongPress={onRowLongPress} style={styles.row}>
      <Text style={[styles.setIndex, {color: withAlpha(theme.colors.onSurfaceVariant, 0.7)}]}>{workoutSet.index}</Text>
      <Pressable testID={PLAN_CELL_TEST_ID(workoutSet.index ?? 0, 'reps')} onPress={() => onCellPress('reps')} style={styles.inlineCell}>
        <Text style={[styles.value, {color: theme.colors.onSurface}]}>{formatPlanNumber(workoutSet.reps)}</Text>
        <Text style={[styles.unit, {color: theme.colors.onSurfaceVariant}]}>reps</Text>
      </Pressable>
      <Text style={[styles.dot, {color: theme.colors.onSurfaceVariant}]}>·</Text>
      <Pressable testID={PLAN_CELL_TEST_ID(workoutSet.index ?? 0, 'rir')} onPress={() => onCellPress('rir')} style={styles.inlineCell}>
        <Text style={[styles.unit, {color: theme.colors.onSurfaceVariant}]}>RIR</Text>
        <Text style={[styles.value, {color: theme.colors.onSurface}]}>{formatPlanNumber(workoutSet.rir)}</Text>
      </Pressable>
      <Pressable testID={PLAN_CELL_TEST_ID(workoutSet.index ?? 0, 'weight')} onPress={() => onCellPress('weight')} style={[styles.inlineCell, styles.weightCell]}>
        <Text style={[styles.value, {color: theme.colors.onSurface}]}>{formatPlanNumber(workoutSet.weight)}</Text>
        <Text style={[styles.unit, {color: theme.colors.onSurfaceVariant}]}>kg</Text>
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 28,
    paddingVertical: 10,
  },
  setIndex: {
    width: 14,
    fontFamily: 'monospace',
    fontSize: 13,
    marginRight: 12,
  },
  inlineCell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '500',
  },
  unit: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 1,
  },
  dot: {
    marginHorizontal: 8,
    fontSize: 14,
  },
  weightCell: {
    marginLeft: 'auto',
  },
});

export default PlanReadSetRow;
