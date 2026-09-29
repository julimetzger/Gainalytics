import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import AnalyseGraphics from '../../../app/tabs/Analyse/AnalyseGraphics';
import {useWorkoutsIn} from '../../../app/redux/Workout/use/useWorkoutsIn';
import {useLastTrainedExerciseId, useLastWorkoutDateForExercises} from '../../../app/redux/Workout/use/useLastWorkoutDate';
import {useAlleExercises} from '../../../app/redux/Exercises/use/useAllExercises';
import {Exercise} from '../../../app/models/entities/Exercise';
import {Workout} from '../../../app/models/entities/Workout';

const SQUAT = {id: 1, name: 'Squat', muscles: []} as unknown as Exercise;
const NEVER_TRAINED = {id: 2, name: 'Mmkv', muscles: []} as unknown as Exercise;

jest.mock('../../../app/redux/Workout/use/useWorkoutsIn', () => ({useWorkoutsIn: jest.fn(() => [])}));
jest.mock('../../../app/redux/Workout/use/useWorkoutsByIds', () => ({useWorkoutsByIds: jest.fn(() => [])}));
jest.mock('../../../app/redux/Exercises/use/useExercisesForMuscles', () => ({useExercisesForMuscles: jest.fn(() => [])}));
jest.mock('../../../app/redux/Exercises/use/useAllExercises', () => ({useAlleExercises: jest.fn(() => [])}));
jest.mock('../../../app/redux/Workout/use/useLastWorkoutDate', () => ({
  useLastWorkoutDate: jest.fn(() => undefined),
  useLastWorkoutDateForExercises: jest.fn(() => undefined),
  useLastTrainedExerciseId: jest.fn(() => undefined),
}));

jest.mock('../../../app/components/Workout/show/WorkoutDoneList', () => {
  const {View} = require('react-native');
  return () => <View testID="workout-done-list" />;
});

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const ReactLocal = require('react');
  const {Text} = require('react-native');
  const actual = jest.requireActual('../../../app/components/picker/date/DateRangePicker');

  return {
    __esModule: true,
    default: ({range}: {range: {startDate: Date; endDate: Date}}) => <Text testID="mock-range-picker">{`${range.startDate.toISOString()}|${range.endDate.toISOString()}`}</Text>,
    Range: actual.Range,
  };
});

// The picker is the only way to make a selection; expose it as two buttons.
jest.mock('../../../app/components/picker/elements/TrainingElementPicker', () => {
  const ReactLocal = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  const actual = jest.requireActual('../../../app/components/picker/elements/TrainingElementPicker');

  return {
    __esModule: true,
    default: ({setExercise}: {setExercise: (exercises: unknown[]) => void}) => (
      <View>
        <TouchableOpacity testID="pick-squat" onPress={() => setExercise([{id: 1, name: 'Squat', muscles: []}])}>
          <Text>pick squat</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="pick-never-trained" onPress={() => setExercise([{id: 2, name: 'Mmkv', muscles: []}])}>
          <Text>pick never trained</Text>
        </TouchableOpacity>
      </View>
    ),
    Accumulation: actual.Accumulation,
  };
});

jest.mock('react-native-charts-wrapper', () => {
  const ReactLocal = require('react');
  const {View} = require('react-native');
  return {
    LineChart: () => <View testID="analyse-line-chart" />,
    processColor: (color: string) => color,
  };
});

const makeWorkout = (id: number, exerciseId: number, start: Date) =>
  ({id, exerciseId, start, end: start, sets: [{reps: 5, weight: 100, rir: 1}]} as unknown as Workout);

const renderScreen = () =>
  render(
    <PaperProvider>
      <AnalyseGraphics {...({} as never)} />
    </PaperProvider>,
  );

beforeEach(() => {
  (useWorkoutsIn as jest.Mock).mockReturnValue([]);
  (useLastWorkoutDateForExercises as jest.Mock).mockReturnValue(undefined);
  (useAlleExercises as jest.Mock).mockReturnValue([SQUAT, NEVER_TRAINED]);
  (useLastTrainedExerciseId as jest.Mock).mockReturnValue(undefined);
});

/**
 * GH-458 (H3): the chart rendered an empty outlined rectangle — no axes, no
 * text — whenever there was nothing to plot. The same blank box stood for "the
 * range holds nothing", "this exercise was never trained" and "something
 * broke", and with no loading indicator anywhere it was not even
 * distinguishable from "still calculating".
 */
describe('Analyse chart empty states (GH-458 H3)', () => {
  it('asks for a selection instead of showing a blank box', () => {
    const {getByTestId, queryByTestId} = renderScreen();

    expect(getByTestId('analyse-chart-no-selection')).toBeTruthy();
    expect(queryByTestId('analyse-line-chart')).toBeNull();
    expect(getByTestId('analyse-chart-no-selection-description').props.children).toContain('Pick an exercise or a muscle group above');
  });

  /**
   * GH-458 round 2 (issue #461): the "nothing selected" starting state used to
   * share a red HelperText with genuine misconfiguration and offered no direct
   * next step. It must now read as a normal empty state, not an error, and
   * offer the last-trained exercise as a one-tap suggestion when there is one.
   */
  it('issue #461: is not styled or worded as an error when nothing is selected yet', () => {
    const {queryByText} = renderScreen();

    expect(queryByText('Please select: Exercise or Muscle.')).toBeNull();
  });

  it('issue #461: suggests the last-trained exercise as a one-tap starting point', () => {
    (useAlleExercises as jest.Mock).mockReturnValue([SQUAT, NEVER_TRAINED]);
    (useLastTrainedExerciseId as jest.Mock).mockReturnValue(1);
    const {getByTestId} = renderScreen();

    expect(getByTestId('analyse-chart-no-selection-description').props.children).toContain('Squat');

    fireEvent.press(getByTestId('analyse-chart-select-suggested'));

    // Squat becomes the selection; with no last-workout date mocked for it,
    // that reads as "never trained" — proving the tap actually applied the
    // suggested exercise, not just closed the empty state.
    expect(getByTestId('analyse-chart-never-trained')).toBeTruthy();
  });

  it('issue #461: offers no suggestion action on a completely empty store', () => {
    (useAlleExercises as jest.Mock).mockReturnValue([]);
    (useLastTrainedExerciseId as jest.Mock).mockReturnValue(undefined);
    const {queryByTestId} = renderScreen();

    expect(queryByTestId('analyse-chart-select-suggested')).toBeNull();
  });

  it('says so when the chosen exercise was never trained at all', () => {
    const {getByTestId, queryByTestId} = renderScreen();

    fireEvent.press(getByTestId('pick-never-trained'));

    expect(getByTestId('analyse-chart-never-trained')).toBeTruthy();
    expect(queryByTestId('analyse-chart-empty-range')).toBeNull();
    expect(getByTestId('analyse-chart-never-trained-description').props.children).toContain('not a single logged set for Mmkv');
  });

  it('offers a way out of a never-trained selection', () => {
    const {getByTestId, queryByTestId} = renderScreen();

    fireEvent.press(getByTestId('pick-never-trained'));
    fireEvent.press(getByTestId('analyse-chart-clear-selection'));

    expect(getByTestId('analyse-chart-no-selection')).toBeTruthy();
    expect(queryByTestId('analyse-chart-never-trained')).toBeNull();
  });

  /**
   * The two cases the audit called pixel-identical must now read differently.
   */
  it('blames the period — and names it — when the exercise does have history', () => {
    (useLastWorkoutDateForExercises as jest.Mock).mockReturnValue(new Date(2026, 1, 28, 19, 30));
    const {getByTestId, queryByTestId} = renderScreen();

    fireEvent.press(getByTestId('pick-squat'));

    expect(getByTestId('analyse-chart-empty-range')).toBeTruthy();
    expect(queryByTestId('analyse-chart-never-trained')).toBeNull();

    const description = getByTestId('analyse-chart-empty-range-description').props.children;
    expect(description).toContain('Squat has no logged sets between');
    expect(description).toContain('The last one was on Sat, 28/02/26.');
  });

  it('jumps the range to the last training of that exercise in one tap', () => {
    const lastTraining = new Date(2026, 1, 28, 19, 30);
    (useLastWorkoutDateForExercises as jest.Mock).mockReturnValue(lastTraining);
    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('pick-squat'));
    fireEvent.press(getByTestId('analyse-chart-jump-to-last'));

    const [startIso, endIso] = getByTestId('mock-range-picker').props.children.split('|');
    expect(new Date(startIso).getTime()).toBeLessThanOrEqual(lastTraining.getTime());
    expect(new Date(endIso).getTime()).toBeGreaterThanOrEqual(lastTraining.getTime());
  });

  it('extends the range to the last twelve months in one tap', () => {
    (useLastWorkoutDateForExercises as jest.Mock).mockReturnValue(new Date(2026, 1, 28, 19, 30));
    const {getByTestId} = renderScreen();

    fireEvent.press(getByTestId('pick-squat'));
    const [beforeStart] = getByTestId('mock-range-picker').props.children.split('|');

    fireEvent.press(getByTestId('analyse-chart-extend-range'));

    const [afterStart] = getByTestId('mock-range-picker').props.children.split('|');
    expect(new Date(afterStart).getTime()).toBeLessThan(new Date(beforeStart).getTime());
  });

  it('renders the chart and no empty state once the period holds sets', () => {
    (useWorkoutsIn as jest.Mock).mockReturnValue([makeWorkout(10, 1, new Date(2026, 1, 20, 18, 0))]);
    (useLastWorkoutDateForExercises as jest.Mock).mockReturnValue(new Date(2026, 1, 20, 18, 0));
    const {getByTestId, queryByTestId} = renderScreen();

    fireEvent.press(getByTestId('pick-squat'));

    expect(getByTestId('analyse-line-chart')).toBeTruthy();
    expect(queryByTestId('analyse-chart-empty-range')).toBeNull();
    expect(queryByTestId('analyse-chart-never-trained')).toBeNull();
    expect(queryByTestId('analyse-chart-no-selection')).toBeNull();
  });
});
