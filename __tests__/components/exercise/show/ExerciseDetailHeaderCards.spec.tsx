import React from 'react';
import {render} from '@testing-library/react-native';
import ExerciseDetailHeaderCards from '../../../../app/components/exercise/show/ExerciseDetailHeaderCards';
import {Record} from '../../../../app/models/entities/Exercise';
import {useExerciseWorkoutSummary} from '../../../../app/redux/Workout/use/useExerciseWorkoutSummary';

jest.mock('../../../../app/redux/Workout/use/useExerciseWorkoutSummary', () => ({
  useExerciseWorkoutSummary: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, View} = require('react-native');
  const Card = ({children, testID}: any) => <View testID={testID}>{children}</View>;
  Card.Content = ({children}: any) => <View>{children}</View>;
  return {
    Card,
    Icon: () => null,
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({colors: {onSurface: '#000', onSurfaceVariant: '#666', primary: '#6200ee', error: '#f00'}}),
  };
});

const mockedSummary = jest.mocked(useExerciseWorkoutSummary);

describe('ExerciseDetailHeaderCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows three cards with placeholders when the exercise has no history', () => {
    mockedSummary.mockReturnValue({lastWorkoutEnd: undefined, totalFinishedWorkouts: 0});
    const {getByTestId} = render(<ExerciseDetailHeaderCards exercise={{id: 1, name: 'Bench'}} />);
    expect(getByTestId('header-card-one-rm')).toBeTruthy();
    expect(getByTestId('header-card-last-workout')).toBeTruthy();
    expect(getByTestId('header-card-total-workouts')).toBeTruthy();
  });

  it('renders the best 1RM, formatted last-workout, and total workouts when data is present', () => {
    mockedSummary.mockReturnValue({
      lastWorkoutEnd: new Date(Date.now() - 2 * 86400000),
      totalFinishedWorkouts: 7,
    });
    const {getByText} = render(
      <ExerciseDetailHeaderCards
        exercise={{
          id: 1,
          name: 'Bench',
          records: {
            [Record.ONE_RM]: [
              {value: 100, workoutId: 1},
              {value: 110, workoutId: 2},
              {value: 120, workoutId: 3},
            ],
          },
        }}
      />,
    );
    expect(getByText('120.0 kg')).toBeTruthy();
    expect(getByText('2d ago')).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
  });

  it('renders the 1RM increase delta when the latest record exceeds the prior best', () => {
    mockedSummary.mockReturnValue({lastWorkoutEnd: new Date(), totalFinishedWorkouts: 1});
    const {getByTestId, getByText} = render(
      <ExerciseDetailHeaderCards
        exercise={{
          id: 1,
          name: 'Bench',
          records: {
            [Record.ONE_RM]: [
              {value: 100, workoutId: 1},
              {value: 105, workoutId: 2},
            ],
          },
        }}
      />,
    );
    expect(getByTestId('header-card-one-rm-delta')).toBeTruthy();
    expect(getByText('+5.0 kg')).toBeTruthy();
  });
});
