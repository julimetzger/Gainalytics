import React from 'react';
import {render} from '@testing-library/react-native';
import ExerciseStatisticsTabs from '../../../app/tabs/exercises/ExerciseStatisticsTabs';
import {useExercise} from '../../../app/redux/Exercises/use/useExercise';
import {useWorkoutsByIds} from '../../../app/redux/Workout/use/useWorkoutsByIds';
import {Record} from '../../../app/models/entities/Exercise';
import {Workout} from '../../../app/models/entities/Workout';

jest.mock('../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  const Card = ({children}: {children: React.ReactNode}) => <View>{children}</View>;
  Card.Title = ({title}: {title: string}) => <Text>{title}</Text>;
  Card.Content = ({children}: {children: React.ReactNode}) => <View>{children}</View>;

  return {
    Card,
    Text: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
  };
});

const mockedUseExercise = jest.mocked(useExercise);
const mockedUseWorkoutsByIds = jest.mocked(useWorkoutsByIds);

describe('ExerciseStatisticsTabs', () => {
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

    const route = {params: {exercise: {id: 2, name: 'Bench'}}};
    const navigation = {setOptions: jest.fn()};

    const {getByText} = render(<ExerciseStatisticsTabs route={route} navigation={navigation} />);

    expect(getByText('Rep Estimates Based on Current 1RM')).toBeTruthy();
    expect(getByText('1 reps @ 120.00 kg')).toBeTruthy();
    expect(getByText('5 reps @ 102.86 kg')).toBeTruthy();
  });

  it('shows fallback text when no current 1RM data is available', () => {
    mockedUseExercise.mockReturnValue({
      id: 2,
      name: 'Bench',
      records: {},
    });
    mockedUseWorkoutsByIds.mockReturnValue([]);

    const route = {params: {exercise: {id: 2, name: 'Bench'}}};
    const navigation = {setOptions: jest.fn()};

    const {getByText} = render(<ExerciseStatisticsTabs route={route} navigation={navigation} />);

    expect(getByText('No current 1RM data available.')).toBeTruthy();
    expect(getByText('No records found.')).toBeTruthy();
  });

  it('deduplicates and sorts one RM records by descending value', () => {
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

    const route = {params: {exercise: {id: 2, name: 'Bench'}}};
    const navigation = {setOptions: jest.fn()};

    const {queryAllByText} = render(<ExerciseStatisticsTabs route={route} navigation={navigation} />);

    expect(queryAllByText(/200.00 kg$/)).toHaveLength(1);

    const recordRows = queryAllByText(/kg$/).map((node) => node.props.children.join(''));
    expect(recordRows).toContain(`${new Date(2024, 0, 1).toDateString()} - 200.00 kg`);
    expect(recordRows).toContain(`${new Date(2024, 0, 3).toDateString()} - 180.00 kg`);
  });
});
