import React from 'react';
import {Pressable, StyleSheet, TextInput as RNTextInput, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {formatPlanFieldValue, formatPlanNumber, getPlanRangeMax} from '../../../utils/planRange';
import {PlanField} from './planTypes';
import {PLAN_CELL_TEST_ID, PLAN_INPUT_TEST_ID} from './planUtils';

interface PlanQuickEditSetRowProps {
  workoutSet: WorkoutSet;
  activeField: PlanField;
  draftValue: string;
  invalid: boolean;
  errorMessage?: string;
  onCellPress: (field: PlanField) => void;
  onChangeText: (value: string) => void;
  onSubmitEditing: () => void;
  onRowLongPress: () => void;
}

const PlanQuickEditSetRow = ({
  workoutSet,
  activeField,
  draftValue,
  invalid,
  errorMessage,
  onCellPress,
  onChangeText,
  onSubmitEditing,
  onRowLongPress,
}: PlanQuickEditSetRowProps) => {
  const theme = useTheme();

  return (
    <View>
      <Pressable onLongPress={onRowLongPress} style={styles.row}>
        <Text style={[styles.setIndex, {color: withAlpha(theme.colors.onSurfaceVariant, 0.7)}]}>{workoutSet.index}</Text>
        {renderCell('reps', 'reps')}
        <Text style={[styles.dot, {color: theme.colors.onSurfaceVariant}]}>·</Text>
        {renderCell('rir', 'RIR')}
        {renderCell('weight', 'kg', true)}
      </Pressable>
      {/* GH-63: the red outline alone does not say why a value was refused —
          e.g. typing 14 into the lower bound of an 8-12 rep range. */}
      {invalid && errorMessage !== undefined && (
        <Text testID={`plan-set-${workoutSet.index}-quick-edit-error`} style={[styles.error, {color: theme.colors.error}]}>
          {errorMessage}
        </Text>
      )}
    </View>
  );

  function renderCell(field: PlanField, accessoryLabel: string, alignRight = false) {
    const selected = field === activeField;
    // GH-63: while the lower bound of a ranged field is edited the upper bound
    // stays visible next to the input, so the range never disappears mid-edit.
    const rangeMax = getPlanRangeMax(workoutSet, field);
    const rangeSuffix = rangeMax === undefined ? null : (
      <Text style={[styles.value, {color: theme.colors.onSurfaceVariant}]}>{`-${formatPlanNumber(rangeMax)}`}</Text>
    );

    if (!selected) {
      return (
        <Pressable testID={PLAN_CELL_TEST_ID(workoutSet.index ?? 0, field)} onPress={() => onCellPress(field)} style={[styles.inlineCell, alignRight && styles.weightCell]}>
          {field === 'rir' && <Text style={[styles.unit, {color: theme.colors.onSurfaceVariant}]}>RIR</Text>}
          <Text style={[styles.value, {color: theme.colors.onSurface}]}>{formatPlanFieldValue(workoutSet, field)}</Text>
          {field !== 'rir' && <Text style={[styles.unit, {color: theme.colors.onSurfaceVariant}]}>{accessoryLabel}</Text>}
        </Pressable>
      );
    }

    return (
      <View
        style={[
          styles.activeCell,
          alignRight && styles.weightCell,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: invalid ? theme.colors.error : theme.colors.primary,
          },
        ]}
      >
        {field === 'rir' && <Text style={[styles.unit, {color: theme.colors.onSurfaceVariant}]}>RIR</Text>}
        <RNTextInput
          // GH-358: this input is mounted by the very tap that selects the cell, so a
          // JS-side inputRef.focus() runs before the ReactEditText is attached to a
          // window. Its internal showSoftInput() then returns false and the failure is
          // discarded, leaving the field focused but the keyboard closed. autoFocus
          // defers the identical native call to onAttachedToWindow, where it succeeds.
          // Switching field/set remounts this input, so autoFocus fires again.
          autoFocus
          testID={PLAN_INPUT_TEST_ID(workoutSet.index ?? 0, field)}
          style={[styles.input, {color: invalid ? theme.colors.error : theme.colors.primary}]}
          value={draftValue}
          onChangeText={onChangeText}
          // GH-358: the accessory "Done" bar was removed. The value is already
          // committed live on every keystroke; the OK/Enter action key just closes
          // the quick-edit (returnKeyType surfaces a labelled action key on the
          // numeric keypad). Tapping outside the row commits via the parent's
          // OutsidePressHandler.
          onSubmitEditing={onSubmitEditing}
          returnKeyType="done"
          keyboardType="numeric"
          selectionColor={theme.colors.primary}
        />
        {rangeSuffix}
        {field !== 'rir' && <Text style={[styles.unit, {color: theme.colors.onSurfaceVariant}]}>{accessoryLabel}</Text>}
      </View>
    );
  }
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
  activeCell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    minWidth: 64,
  },
  input: {
    minWidth: 30,
    padding: 0,
    margin: 0,
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '600',
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
  error: {
    paddingLeft: 28,
    paddingBottom: 6,
    fontSize: 12,
  },
});

export default PlanQuickEditSetRow;
