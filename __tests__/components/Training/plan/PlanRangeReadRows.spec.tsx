import React from 'react';
import {fireEvent, render, within} from '@testing-library/react-native';
import PlanReadSetRow from '../../../../app/components/Training/plan/PlanReadSetRow';
import {PLAN_CELL_TEST_ID} from '../../../../app/components/Training/plan/planUtils';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

// GH-63: the plan list renders a range as "8-12" and keeps rendering a fixed
// value exactly as before.

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

describe('PlanReadSetRow — opening the editing (GH-418)', () => {
  it('opens the editing on a long press on any value cell, not only on the row gaps', () => {
    const onRowLongPress = jest.fn();
    const onCellPress = jest.fn();
    const {getByTestId} = render(<PlanReadSetRow workoutSet={fixedSet} onCellPress={onCellPress} onRowLongPress={onRowLongPress} />);

    fireEvent(getByTestId(PLAN_CELL_TEST_ID(1, 'reps')), 'longPress');
    fireEvent(getByTestId(PLAN_CELL_TEST_ID(1, 'weight')), 'longPress');

    expect(onRowLongPress).toHaveBeenCalledTimes(2);
    expect(onCellPress).not.toHaveBeenCalled();
  });

  it('reports which field was tapped', () => {
    const onCellPress = jest.fn();
    const {getByTestId} = render(<PlanReadSetRow workoutSet={fixedSet} onCellPress={onCellPress} onRowLongPress={jest.fn()} />);

    fireEvent.press(getByTestId(PLAN_CELL_TEST_ID(1, 'rir')));

    expect(onCellPress).toHaveBeenCalledWith('rir');
  });
});
