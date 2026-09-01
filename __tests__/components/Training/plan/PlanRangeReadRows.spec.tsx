import React from 'react';
import {render, within} from '@testing-library/react-native';
import PlanReadSetRow from '../../../../app/components/Training/plan/PlanReadSetRow';
import PlanQuickEditSetRow from '../../../../app/components/Training/plan/PlanQuickEditSetRow';
import {PLAN_CELL_TEST_ID} from '../../../../app/components/Training/plan/planUtils';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

// GH-63: the plan list renders a range as "8-12" and keeps rendering a fixed
// value exactly as before. Quick edit still edits the lower bound only and says
// out loud why a value was refused.

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

const rangedSet: WorkoutSet = {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12, rirMax: 3, weightMax: 110};
const fixedSet: WorkoutSet = {index: 1, reps: 8, rir: 1, weight: 100};

// The value of a cell is the one text node inside it that is not the unit label.
const valueOf = (getByTestId: (id: string) => any, setIndex: number, field: 'reps' | 'rir' | 'weight', unit: string) => {
  const texts = within(getByTestId(PLAN_CELL_TEST_ID(setIndex, field)))
    .getAllByText(/.+/)
    .map((node) => node.props.children);
  return texts.filter((text) => text !== unit).join('');
};

const cellText = (getByTestId: (id: string) => any, setIndex: number) => ({
  reps: valueOf(getByTestId, setIndex, 'reps', 'reps'),
  rir: valueOf(getByTestId, setIndex, 'rir', 'RIR'),
  weight: valueOf(getByTestId, setIndex, 'weight', 'kg'),
});

describe('PlanReadSetRow (GH-63)', () => {
  it('renders each range as "from-to"', () => {
    const {getByTestId} = render(
      <PlanReadSetRow workoutSet={rangedSet} onCellPress={jest.fn()} onRowLongPress={jest.fn()} />,
    );
    expect(cellText(getByTestId, 1)).toEqual({reps: '8-12', rir: '1-3', weight: '100-110'});
  });

  it('renders a fixed set exactly as before', () => {
    const {getByTestId} = render(
      <PlanReadSetRow workoutSet={fixedSet} onCellPress={jest.fn()} onRowLongPress={jest.fn()} />,
    );
    expect(cellText(getByTestId, 1)).toEqual({reps: '8', rir: '1', weight: '100'});
  });
});

describe('PlanQuickEditSetRow (GH-63)', () => {
  const renderQuickEdit = (workoutSet: WorkoutSet, draftValue: string, invalid: boolean, errorMessage?: string) =>
    render(
      <PlanQuickEditSetRow
        workoutSet={workoutSet}
        activeField="reps"
        draftValue={draftValue}
        invalid={invalid}
        errorMessage={errorMessage}
        onCellPress={jest.fn()}
        onChangeText={jest.fn()}
        onSubmitEditing={jest.fn()}
        onRowLongPress={jest.fn()}
      />,
    );

  it('edits the lower bound while the upper bound stays on screen', () => {
    const {getByTestId} = renderQuickEdit(rangedSet, '10', false);
    expect({
      input: getByTestId('plan-set-1-reps-input').props.value,
      untouchedRir: valueOf(getByTestId, 1, 'rir', 'RIR'),
    }).toEqual({input: '10', untouchedRir: '1-3'});
  });

  it('shows the reason a refused value was not accepted', () => {
    const message = 'Reps range: the first value must be less than 12.';
    const {getByTestId} = renderQuickEdit(rangedSet, '14', true, message);
    expect(getByTestId('plan-set-1-quick-edit-error').props.children).toEqual(message);
  });

  it('shows no error row for a valid edit', () => {
    const {queryByTestId} = renderQuickEdit(rangedSet, '10', false);
    expect(queryByTestId('plan-set-1-quick-edit-error')).toEqual(null);
  });
});
