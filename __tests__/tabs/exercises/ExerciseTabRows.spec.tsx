import React from 'react';
import {render} from '@testing-library/react-native';
import ExerciseTab from '../../../app/tabs/exercises/ExerciseTab';
import {Record} from '../../../app/models/entities/Exercise';
import {useAlleExercises} from '../../../app/redux/Exercises/use/useAllExercises';
import {useExerciseWorkoutSummary} from '../../../app/redux/Workout/use/useExerciseWorkoutSummary';

jest.mock('../../../app/redux/Exercises/use/useAllExercises', () => ({
  useAlleExercises: jest.fn(),
}));
jest.mock('../../../app/redux/Workout/use/useExerciseWorkoutSummary', () => ({
  useExerciseWorkoutSummary: jest.fn(),
}));
jest.mock('../../../app/components/exercise/show/Sparkline', () => () => null);

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, View, TouchableOpacity} = require('react-native');
  const Card = ({children}: any) => <View>{children}</View>;
  Card.Content = ({children}: any) => <View>{children}</View>;
  return {
    Card,
    Chip: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    FAB: ({onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>fab</Text>
      </TouchableOpacity>
    ),
    Icon: () => null,
    Searchbar: ({value, onChangeText, testID, placeholder}: any) => {
      const {TextInput} = require('react-native');
      return <TextInput testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder} />;
    },
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({colors: {background: '#fff', primary: '#6200ee', onPrimary: '#fff', onSurface: '#000', onSurfaceVariant: '#666', outlineVariant: '#ccc', surfaceVariant: '#eee', error: '#f00'}}),
  };
});

const mockedAll = jest.mocked(useAlleExercises);
const mockedSummary = jest.mocked(useExerciseWorkoutSummary);

describe('ExerciseTab rows + focus carousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSummary.mockImplementation((exerciseId) => {
      if (exerciseId === 5) return {lastWorkoutEnd: new Date(Date.now() - 3 * 86400000), totalFinishedWorkouts: 4};
      if (exerciseId === 6) return {lastWorkoutEnd: new Date(Date.now() - 86400000), totalFinishedWorkouts: 1};
      return {lastWorkoutEnd: undefined, totalFinishedWorkouts: 0};
    });
  });

  const navigation = {navigate: jest.fn()} as any;

  it('renders a "last done" cell on each compact row', () => {
    mockedAll.mockReturnValue([
      {id: 5, name: 'Bench', isFocus: false},
      {id: 6, name: 'Squat', isFocus: false},
      {id: 7, name: 'Press', isFocus: false},
    ]);
    const {getByTestId} = render(<ExerciseTab navigation={navigation} route={{} as any} />);
    expect(getByTestId('exercise-row-last-done-5')).toBeTruthy();
    expect(getByTestId('exercise-row-last-done-6')).toBeTruthy();
    expect(getByTestId('exercise-row-last-done-7')).toBeTruthy();
  });

  it('renders a 1RM increase delta pill on focus carousel cards when the latest 1RM is a new PR', () => {
    mockedAll.mockReturnValue([
      {
        id: 6,
        name: 'Bench',
        isFocus: true,
        records: {
          [Record.ONE_RM]: [
            {value: 100, workoutId: 1},
            {value: 110, workoutId: 2},
          ],
        },
      },
    ]);
    const {getByTestId} = render(<ExerciseTab navigation={navigation} route={{} as any} />);
    expect(getByTestId('focus-card-delta-6')).toBeTruthy();
  });

  it('does not render a delta pill when the exercise has fewer than two 1RM records', () => {
    mockedAll.mockReturnValue([
      {
        id: 7,
        name: 'Bench',
        isFocus: true,
        records: {[Record.ONE_RM]: [{value: 100, workoutId: 1}]},
      },
    ]);
    const {queryByTestId} = render(<ExerciseTab navigation={navigation} route={{} as any} />);
    expect(queryByTestId('focus-card-delta-7')).toBeNull();
  });
});
