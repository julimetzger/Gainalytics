/// <reference types="@testing-library/jest-native" />
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import RecordsTab from '../../../app/tabs/Analyse/Records';
import {Exercise, Record} from '../../../app/models/entities/Exercise';
import {Muscles} from '../../../app/models/Muscles';
import {Workout} from '../../../app/models/entities/Workout';

// GH-617: the Records screen keeps one selected tile; the list shows its
// records, and any change of range or filter drops the selection.

const mockSquat: Exercise = {id: 1, name: 'Squat', muscles: [{muscle: Muscles.QUADS, percent: 100}]};
const mockBench: Exercise = {id: 2, name: 'Bench', muscles: [{muscle: Muscles.CHEST, percent: 100}]};

const recordWorkout = (id: number, exerciseId: number, start: Date, oneRm: number): Workout => ({
  id,
  exerciseId,
  start,
  sets: [{reps: 5, rir: 1, weight: 100}],
  records: {[Record.ONE_RM]: oneRm},
});

// Mon Jul 6 2026 (2 records) and Mon Jul 13 2026 (1 record); today is in that range.
const mockWorkouts = [recordWorkout(1, 1, new Date(2026, 6, 7), 180), recordWorkout(2, 2, new Date(2026, 6, 8), 120), recordWorkout(3, 1, new Date(2026, 6, 14), 185)];

jest.mock('../../../app/redux/Workout/use/useWorkoutsIn', () => ({useWorkoutsIn: () => mockWorkouts}));
jest.mock('../../../app/redux/Exercises/use/useAllExercises', () => ({useAlleExercises: () => [mockSquat, mockBench]}));
jest.mock('../../../app/redux/Exercises/use/useExercisesForMuscles', () => ({useExercisesForMuscles: () => []}));

jest.mock('../../../app/components/picker/elements/TrainingElementPicker', () => {
  const actual = jest.requireActual('../../../app/components/picker/elements/TrainingElementPicker');
  const {Text, TouchableOpacity} = require('react-native');
  return {
    __esModule: true,
    Accumulation: actual.Accumulation,
    default: ({setExercise, visible, collapseToSummary}: {setExercise: (exercises: Exercise[]) => void; visible?: boolean; collapseToSummary?: boolean}) => (
      <TouchableOpacity testID="mock-pick-squat" onPress={() => setExercise([mockSquat])}>
        <Text testID="mock-picker-state">{`visible=${String(visible)} collapseToSummary=${String(collapseToSummary)}`}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const actual = jest.requireActual('../../../app/components/picker/date/DateRangePicker');
  const {Text, TouchableOpacity} = require('react-native');
  return {
    __esModule: true,
    Range: actual.Range,
    default: ({setRange}: {setRange: (range: unknown) => void}) => (
      <TouchableOpacity testID="mock-set-range" onPress={() => setRange(new actual.Range(new Date(2026, 6, 1), new Date(2026, 6, 31, 23, 59, 59)))}>
        <Text>range</Text>
      </TouchableOpacity>
    ),
  };
});

describe('Records tile selection (GH-617)', () => {
  beforeEach(() => {
    jest.useFakeTimers({now: new Date(2026, 6, 20, 12)});
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const renderScreen = () =>
    render(
      <PaperProvider>
        <RecordsTab />
      </PaperProvider>,
    );

  it('mounts the filter header collapsed to its summary', () => {
    renderScreen();
    expect(screen.getByTestId('mock-picker-state')).toHaveTextContent('visible=false collapseToSummary=true');
  });

  it('filters the list to the tapped tile and restores it on a second tap', () => {
    renderScreen();
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('3 shown');

    fireEvent.press(screen.getByTestId('records-tile-week-2026-07-06'));
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('2 records · week of 07/06/26');
    expect(screen.queryByTestId('record-card-2')).toBeNull();

    fireEvent.press(screen.getByTestId('records-tile-week-2026-07-13'));
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('1 record · week of 07/13/26');

    fireEvent.press(screen.getByTestId('records-tile-week-2026-07-13'));
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('3 shown');
  });

  it('"Show all" clears the tile filter', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('records-tile-week-2026-07-06'));
    fireEvent.press(screen.getByTestId('records-show-all'));
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('3 shown');
    expect(screen.queryByTestId('records-show-all')).toBeNull();
  });

  it('a new date range drops the tile selection', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('records-tile-week-2026-07-06'));
    fireEvent.press(screen.getByTestId('mock-set-range'));
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('3 shown');
  });

  it('an exercise filter change drops the tile selection', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('records-tile-week-2026-07-06'));
    fireEvent.press(screen.getByTestId('mock-pick-squat'));
    // Only the two Squat records remain, unfiltered by the tile.
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('2 shown');
  });

  it('switching to "By muscle" drops the heatmap selection; a bar filters the list there', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('records-tile-week-2026-07-06'));
    fireEvent.press(screen.getByTestId('records-view-muscle'));
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('3 shown');

    // Default range starts Mon Apr 20 (3 months before the week of Jul 20) → Jul 6 is week bucket 11.
    fireEvent.press(screen.getByTestId('records-bar-Legs-11'));
    expect(screen.getByTestId('records-shown-count')).toHaveTextContent('1 record · Legs · week of 07/06/26');
  });
});
