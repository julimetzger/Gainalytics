import React from 'react';
import {render} from '@testing-library/react-native';
import PlanQuickEditSetRow from '../../../../app/components/Training/plan/PlanQuickEditSetRow';
import {PlanField} from '../../../../app/components/Training/plan/planTypes';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

// GH-358: tapping a plan set value focused the field but never opened the soft
// keyboard on a real device (Samsung SM-G986B / Android 13).
//
// The active cell's TextInput is mounted by the very same commit that selects it.
// A JS-side inputRef.current.focus() therefore runs before the underlying
// ReactEditText is attached to a window. Its native helper
// requestFocusProgrammatically() calls InputMethodManager.showSoftInput(view, 0),
// which returns false for a view without a window token — and RN discards that
// return value. The view keeps the focus (mServedView == ReactEditText) while the
// IME is never asked to show (mShowRequested == false).
//
// The `autoFocus` prop routes the identical native call through
// ReactEditText.onAttachedToWindow(), where showSoftInput() succeeds. These tests
// pin that prop: they fail against the previous inputRef/useEffect implementation,
// where autoFocus is undefined.

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {
    Text,
    useTheme: () => ({
      colors: {
        onSurface: '#ffffff',
        onSurfaceVariant: '#cccccc',
        surfaceVariant: '#222222',
        primary: '#3366ff',
        error: '#ff3333',
      },
    }),
  };
});

const workoutSet = {
  index: 1,
  reps: 8,
  rir: 2,
  weight: 180,
} as WorkoutSet;

const renderRow = (activeField: PlanField, draftValue: string) =>
  render(
    <PlanQuickEditSetRow
      workoutSet={workoutSet}
      activeField={activeField}
      draftValue={draftValue}
      invalid={false}
      onCellPress={jest.fn()}
      onChangeText={jest.fn()}
      onSubmitEditing={jest.fn()}
      onRowLongPress={jest.fn()}
    />,
  );

describe('PlanQuickEditSetRow (GH-358 keyboard)', () => {
  it.each<[PlanField, string]>([
    ['reps', '8'],
    ['rir', '2'],
    ['weight', '180'],
  ])('renders the %s input with autoFocus so the IME opens on mount', (field, draftValue) => {
    const {getByTestId} = renderRow(field, draftValue);

    const input = getByTestId(`plan-set-1-${field}-input`);

    expect(input.props.autoFocus).toBe(true);
    expect(input.props.value).toBe(draftValue);
    expect(input.props.keyboardType).toBe('numeric');
  });

  it('renders an input only for the active field, so the other cells stay read-only', () => {
    const {getByTestId, queryByTestId} = renderRow('reps', '8');

    expect(getByTestId('plan-set-1-reps-input')).toBeTruthy();
    expect(queryByTestId('plan-set-1-rir-input')).toBeNull();
    expect(queryByTestId('plan-set-1-weight-input')).toBeNull();
    // the inactive fields still expose their tappable read cells
    expect(getByTestId('plan-set-1-rir-cell')).toBeTruthy();
    expect(getByTestId('plan-set-1-weight-cell')).toBeTruthy();
  });

  it('mounts a fresh autoFocus input when the active field changes', () => {
    const {getByTestId, queryByTestId, rerender} = renderRow('reps', '8');

    expect(getByTestId('plan-set-1-reps-input').props.autoFocus).toBe(true);

    rerender(
      <PlanQuickEditSetRow
        workoutSet={workoutSet}
        activeField="weight"
        draftValue="180"
        invalid={false}
        onCellPress={jest.fn()}
        onChangeText={jest.fn()}
        onSubmitEditing={jest.fn()}
        onRowLongPress={jest.fn()}
      />,
    );

    // the reps input is unmounted and the weight input mounts fresh, which is what
    // re-triggers ReactEditText.onAttachedToWindow() -> showSoftInput()
    expect(queryByTestId('plan-set-1-reps-input')).toBeNull();
    expect(getByTestId('plan-set-1-weight-input').props.autoFocus).toBe(true);
  });
});
