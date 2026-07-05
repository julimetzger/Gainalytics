import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';

jest.mock('react-native-paper', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  const Dialog = Object.assign(
    ({visible, children, testID}: any) => (visible ? <View testID={testID}>{children}</View> : null),
    {
      Title: ({children}: any) => <Text testID="dialog-title">{children}</Text>,
      Content: ({children}: any) => <View>{children}</View>,
      Actions: ({children}: any) => <View>{children}</View>,
    },
  );
  return {
    Dialog,
    IconButton: ({onPress, testID, icon}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{icon}</Text>
      </TouchableOpacity>
    ),
    Portal: ({children}: any) => <>{children}</>,
    Text: ({children, testID, style}: any) => (
      <Text testID={testID} style={style}>
        {children}
      </Text>
    ),
    useTheme: () => ({
      colors: {
        primary: '#0066ff',
        onSurface: '#000',
        onSurfaceVariant: '#666',
        outlineVariant: '#ccc',
        primaryContainer: '#e8f0ff',
        surface: '#fff',
      },
    }),
  };
});

jest.mock('../../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(),
}));

jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(() => []),
}));

import ExerciseRecordsModal from '../../../../app/components/Training/execute/ExerciseRecordsModal';
import {Record} from '../../../../app/models/entities/Exercise';

const mockedUseExercise = require('../../../../app/redux/Exercises/use/useExercise').useExercise as jest.Mock;
const mockedUseWorkoutsByIds = require('../../../../app/redux/Workout/use/useWorkoutsByIds').useWorkoutsByIds as jest.Mock;

const EXERCISE = {id: 42, name: 'Bench Press'};

describe('ExerciseRecordsModal', () => {
  beforeEach(() => {
    mockedUseExercise.mockReset();
    mockedUseWorkoutsByIds.mockReturnValue([]);
  });

  it('does not render when visible is false', () => {
    mockedUseExercise.mockReturnValue(EXERCISE);
    const {queryByTestId} = render(
      <ExerciseRecordsModal visible={false} onDismiss={jest.fn()} exercise={EXERCISE} />,
    );
    expect(queryByTestId('exercise-records-modal')).toBeNull();
  });

  it('shows empty state when exercise has no records', () => {
    mockedUseExercise.mockReturnValue({...EXERCISE, records: undefined});
    const {getByTestId} = render(
      <ExerciseRecordsModal visible={true} onDismiss={jest.fn()} exercise={EXERCISE} />,
    );
    expect(getByTestId('exercise-records-empty')).toBeTruthy();
  });

  it('shows records sorted by value descending using the Stats table format', () => {
    mockedUseExercise.mockReturnValue({
      ...EXERCISE,
      records: {
        [Record.ONE_RM]: [
          {value: 100, workoutId: 1},
          {value: 130, workoutId: 2},
          {value: 115, workoutId: 3},
        ],
      },
    });
    const {getByTestId} = render(
      <ExerciseRecordsModal visible={true} onDismiss={jest.fn()} exercise={EXERCISE} />,
    );
    // Records rendered using ExerciseOneRmRecordsTable (same as Stats tab)
    expect(getByTestId('one-rm-records-list')).toBeTruthy();
    expect(getByTestId('one-rm-record-value-0').props.children).toBe('130.0 kg');
    expect(getByTestId('one-rm-record-value-1').props.children).toBe('115.0 kg');
    expect(getByTestId('one-rm-record-value-2').props.children).toBe('100.0 kg');
  });

  it('shows records for the correct exercise (bound to chosenExercise.id)', () => {
    const otherExercise = {id: 99, name: 'Squat'};
    mockedUseExercise.mockImplementation((id: number) => {
      if (id === 42) return {...EXERCISE, records: {[Record.ONE_RM]: [{value: 120, workoutId: 1}]}};
      return otherExercise;
    });
    const {getByTestId, getByText} = render(
      <ExerciseRecordsModal visible={true} onDismiss={jest.fn()} exercise={EXERCISE} />,
    );
    expect(getByTestId('one-rm-record-value-0').props.children).toBe('120.0 kg');
    expect(getByText('Records: Bench Press')).toBeTruthy();
  });

  it('calls onDismiss when close button is pressed', () => {
    mockedUseExercise.mockReturnValue({...EXERCISE, records: undefined});
    const onDismiss = jest.fn();
    const {getByTestId} = render(
      <ExerciseRecordsModal visible={true} onDismiss={onDismiss} exercise={EXERCISE} />,
    );
    fireEvent.press(getByTestId('exercise-records-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
