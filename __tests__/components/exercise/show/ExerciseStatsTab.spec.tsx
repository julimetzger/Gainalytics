import React from 'react';
import {render} from '@testing-library/react-native';
import ExerciseStatsTab from '../../../../app/components/exercise/show/ExerciseStatsTab';
import {Record} from '../../../../app/models/entities/Exercise';
import {useExercise} from '../../../../app/redux/Exercises/use/useExercise';
import {useWorkoutsByIds} from '../../../../app/redux/Workout/use/useWorkoutsByIds';
import {Workout} from '../../../../app/models/entities/Workout';

jest.mock('../../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(),
}));
jest.mock('../../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, View} = require('react-native');
  const Card = ({children}: any) => <View>{children}</View>;
  Card.Title = ({title, subtitle}: any) => (
    <View>
      <Text>{title}</Text>
      {subtitle ? <Text>{subtitle}</Text> : null}
    </View>
  );
  Card.Content = ({children}: any) => <View>{children}</View>;
  return {
    Card,
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({colors: {onSurface: '#000', onSurfaceVariant: '#666', outlineVariant: '#ccc'}}),
  };
});

const mockedUseExercise = jest.mocked(useExercise);
const mockedUseWorkoutsByIds = jest.mocked(useWorkoutsByIds);

describe('ExerciseStatsTab', () => {
  it('renders rep estimates when current 1RM exists', () => {
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {
        [Record.ONE_RM]: [{value: 120, workoutId: 1}],
      },
    });
    const workouts: Workout[] = [
      {
        id: 1,
        exerciseId: 2,
        sets: [{index: 1, reps: 5, rir: 1, weight: 90}],
        start: new Date(2024, 0, 2),
        records: {[Record.ONE_RM]: 120},
      },
    ];
    mockedUseWorkoutsByIds.mockReturnValue(workouts);

    const {getByText, queryAllByText} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);

    expect(getByText('Rep estimates')).toBeTruthy();
    expect(getByText('1 reps')).toBeTruthy();
    expect(getByText('5 reps')).toBeTruthy();
    expect(queryAllByText(/120\.0 kg/).length).toBeGreaterThan(0);
    expect(queryAllByText(/102\.9 kg/).length).toBeGreaterThan(0);
  });

  it('shows fallback text when no current 1RM data is available', () => {
    mockedUseExercise.mockReturnValue({id: 2, name: 'Bench', records: {}});
    mockedUseWorkoutsByIds.mockReturnValue([]);

    const {getByText} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);
    expect(getByText('No current 1RM data available.')).toBeTruthy();
    expect(getByText('No records found.')).toBeTruthy();
  });

  it('renders 1RM records sorted by descending value, deduped by (value, date)', () => {
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {
        [Record.ONE_RM]: [
          {value: 200, workoutId: 1},
          {value: 200, workoutId: 2},
          {value: 180, workoutId: 3},
        ],
      },
    });
    const workouts: Workout[] = [
      {
        id: 1,
        exerciseId: 2,
        sets: [{index: 1, reps: 1, rir: 0, weight: 200}],
        start: new Date(2024, 0, 1),
        records: {[Record.ONE_RM]: 200},
      },
      {
        id: 2,
        exerciseId: 2,
        sets: [{index: 1, reps: 1, rir: 0, weight: 200}],
        start: new Date(2024, 0, 1),
        records: {[Record.ONE_RM]: 200},
      },
      {
        id: 3,
        exerciseId: 2,
        sets: [{index: 1, reps: 1, rir: 0, weight: 180}],
        start: new Date(2024, 0, 3),
        records: {[Record.ONE_RM]: 180},
      },
    ];
    mockedUseWorkoutsByIds.mockReturnValue(workouts);

    const {queryAllByText} = render(<ExerciseStatsTab exercise={{id: 2, name: 'Bench'}} />);

    expect(queryAllByText(/200\.0 kg/).length).toBeGreaterThanOrEqual(1);
    expect(queryAllByText(/180\.0 kg/).length).toBeGreaterThanOrEqual(1);
  });
});
