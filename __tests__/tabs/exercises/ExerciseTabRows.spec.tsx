import React from 'react';
import {act, render} from '@testing-library/react-native';
import type {ReactTestInstance} from 'react-test-renderer';
import ExerciseTab, {exerciseListStages} from '../../../app/tabs/exercises/ExerciseTab';
import {Record} from '../../../app/models/entities/Exercise';
import {useAlleExercises} from '../../../app/redux/Exercises/use/useAllExercises';
import {useExerciseWorkoutSummary} from '../../../app/redux/Workout/use/useExerciseWorkoutSummary';
import {useOneRmSessionHistory} from '../../../app/redux/Workout/use/useOneRmSessionHistory';

jest.mock('../../../app/redux/Exercises/use/useAllExercises', () => ({
  useAlleExercises: jest.fn(),
}));
jest.mock('../../../app/redux/Workout/use/useExerciseWorkoutSummary', () => ({
  useExerciseWorkoutSummary: jest.fn(),
}));
jest.mock('../../../app/redux/Workout/use/useOneRmSessionHistory', () => ({
  useOneRmSessionHistory: jest.fn(() => []),
}));
const mockSparklineValues: number[][] = [];
jest.mock('../../../app/components/exercise/show/Sparkline', () => ({values}: {values: number[]}) => {
  mockSparklineValues.push(values);
  return null;
});

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
const mockedSessionHistory = jest.mocked(useOneRmSessionHistory);

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

  // GH-477: the sparklines plot the e1RM of every session, not only the record
  // list — a weaker session after a record must show up as a drop.
  it('feeds the per-session e1RM history (not the records) into row and focus-card sparklines', () => {
    mockSparklineValues.length = 0;
    mockedSessionHistory.mockImplementation((exerciseId) => (exerciseId === 6 ? [100, 120, 90] : []));
    mockedAll.mockReturnValue([
      {
        id: 6,
        name: 'Bench',
        isFocus: true,
        records: {
          [Record.ONE_RM]: [
            {value: 100, workoutId: 1},
            {value: 120, workoutId: 2},
          ],
        },
      },
    ]);
    render(<ExerciseTab navigation={navigation} route={{} as any} />);
    expect(mockedSessionHistory).toHaveBeenCalledWith(6);
    // one focus card + one list row
    expect(mockSparklineValues).toEqual([
      [100, 120, 90],
      [100, 120, 90],
    ]);
  });
});

// GH-675: opening the tab used to build all rows in one commit (one 261 ms frame on the device). The first
// screen of rows comes first, the rest a few rows per frame, until every row is there.
describe('ExerciseTab staged rows (GH-675)', () => {
  const navigation = {navigate: jest.fn()} as any;
  const rowIds = (rows: ReactTestInstance[]) => rows.map((row) => row.props.testID);
  const ROW_ID = /^exercise-row-\d+$/;

  beforeEach(() => {
    jest.useFakeTimers();
    mockedSummary.mockReturnValue({lastWorkoutEnd: undefined, totalFinishedWorkouts: 0});
    const names = Array.from({length: 30}, (_, i) => `Exercise ${String(i + 1).padStart(2, '0')}`);
    mockedAll.mockReturnValue(names.map((name, i) => ({id: i + 1, name, isFocus: false})));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the first 12 rows first and every row a few frames later, in list order', () => {
    const {queryAllByTestId} = render(<ExerciseTab navigation={navigation} route={{} as any} />);

    expect(rowIds(queryAllByTestId(ROW_ID))).toEqual(Array.from({length: 12}, (_, i) => `exercise-row-${i + 1}`));

    // one stage per frame; each stage arms the next timer after its render
    const nextFrame = () =>
      act(() => {
        jest.advanceTimersByTime(16);
      });
    nextFrame();
    expect(rowIds(queryAllByTestId(ROW_ID))).toHaveLength(18);

    nextFrame();
    nextFrame();
    expect(rowIds(queryAllByTestId(ROW_ID))).toEqual(Array.from({length: 30}, (_, i) => `exercise-row-${i + 1}`));
  });

  it('uses as many stages as needed so the last one adds at most 6 rows', () => {
    expect([0, 12, 13, 18, 19, 82].map(exerciseListStages)).toEqual([1, 1, 2, 2, 3, 13]);
  });
});
