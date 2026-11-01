/// <reference types="@testing-library/jest-native" />
import React, {useState} from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import AnalyseFilterPanel from '../../../../app/components/picker/filter/AnalyseFilterPanel';
import {Range} from '../../../../app/components/picker/date/DateRangePicker';
import {Accumulation} from '../../../../app/models/Accumulation';
import {AccumulationMode} from '../../../../app/models/AccumulationMode';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Metric} from '../../../../app/models/Metric';
import {Muscles} from '../../../../app/models/Muscles';

const mockSquat = {id: 1, name: 'Squat', muscles: []} satisfies Exercise;
const mockBench = {id: 2, name: 'Bench Press', muscles: []} satisfies Exercise;
const mockDeadlift = {id: 3, name: 'Deadlift', muscles: []} satisfies Exercise;
const mockCurl = {id: 4, name: 'Curl', muscles: []} satisfies Exercise;
const mockPlans = [
  {id: 10, name: 'Push pull'},
  {id: 11, name: 'Upper lower'},
];

jest.mock('../../../../app/redux/Exercises/use/useAllExercises', () => ({useAlleExercises: () => [mockSquat, mockBench, mockDeadlift, mockCurl]}));
jest.mock('../../../../app/redux/Training/use/useAllTrainingsPlans', () => ({useAllTrainingsPlans: () => mockPlans}));
jest.mock('../../../../app/redux/settings/use/useMuscles', () => ({useAvailableMuscles: () => ['Quads', 'Chest', 'Back']}));
// Curl was never trained: it is no quick pick and not "Recent".
jest.mock('../../../../app/redux/Workout/use/useExerciseTrainingStats', () => ({
  useExerciseTrainingStats: () => ({
    1: {count: 12, last: new Date(2026, 9, 25, 10).getTime()},
    2: {count: 9, last: new Date(2026, 9, 20, 10).getTime()},
    3: {count: 4, last: new Date(2026, 6, 1, 10).getTime()},
  }),
}));
jest.mock('@shopify/flash-list', () => {
  const {View} = require('react-native');
  return {
    FlashList: ({data, renderItem, keyExtractor}: {data: unknown[]; renderItem: (info: {item: unknown}) => React.ReactNode; keyExtractor: (item: unknown) => string}) => (
      <View>
        {data.map((item) => (
          <View key={keyExtractor(item)}>{renderItem({item})}</View>
        ))}
      </View>
    ),
  };
});

const TODAY = new Date(2026, 9, 27, 12);

interface HarnessProps {
  initialRange?: Range;
  full?: boolean;
}

/** Holds the filter state like a screen does, so every change shows up in the panel. */
const Harness = ({initialRange = new Range(new Date(2026, 6, 28), new Date(2026, 9, 27, 23, 59, 59)), full = true}: HarnessProps) => {
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>([]);
  const [range, setRange] = useState(initialRange);
  const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.SINGLE_DAY));
  const [metrics, setMetrics] = useState<Metric[]>([]);
  return full ? (
    <AnalyseFilterPanel
      exercise={exercise}
      setExercise={setExercise}
      muscle={muscle}
      setMuscle={setMuscle}
      range={range}
      setRange={setRange}
      accumulation={accumulation}
      setAccumulation={setAccumulation}
      metrics={metrics}
      setMetrics={setMetrics}
    />
  ) : (
    <AnalyseFilterPanel exercise={exercise} setExercise={setExercise} muscle={muscle} setMuscle={setMuscle} />
  );
};

const renderPanel = (props: HarnessProps = {}) =>
  render(
    <PaperProvider>
      <Harness {...props} />
    </PaperProvider>,
  );

const text = (testID: string) => screen.getByTestId(testID).props.children;

describe('AnalyseFilterPanel (GH-642)', () => {
  beforeEach(() => jest.useFakeTimers({now: TODAY}));
  afterEach(() => jest.useRealTimers());

  it('starts collapsed with the three summary lines', () => {
    renderPanel();
    expect([text('filter-range-label'), text('filter-selection-summary'), text('filter-groupby-summary')]).toEqual(['28 Jul – 27 Oct 2026', 'All exercises', 'Day · All metrics']);
    expect(screen.queryByTestId('filter-panel-collapse')).toBeNull();
  });

  it('steps the period with the arrows and never past today', () => {
    renderPanel();
    expect(screen.getByTestId('filter-range-next')).toBeDisabled();
    fireEvent.press(screen.getByTestId('filter-range-previous'));
    expect(text('filter-range-label')).toBe('27 Apr – 27 Jul 2026');
    fireEvent.press(screen.getByTestId('filter-range-next'));
    expect(text('filter-range-label')).toBe('28 Jul – 27 Oct 2026');
  });

  it('selects three most-trained exercises with three taps after expanding', () => {
    renderPanel();
    fireEvent.press(screen.getByTestId('filter-panel-expand'));
    fireEvent.press(screen.getByTestId('filter-exercise-chip-1'));
    fireEvent.press(screen.getByTestId('filter-exercise-chip-2'));
    fireEvent.press(screen.getByTestId('filter-exercise-chip-3'));
    expect(text('filter-exercise-section-title')).toBe('Exercises (3)');
    // never trained -> no quick pick
    expect(screen.queryByTestId('filter-exercise-chip-4')).toBeNull();
    fireEvent.press(screen.getByTestId('filter-panel-collapse'));
    expect(text('filter-selection-summary')).toBe('Squat, Bench Press, Deadlift');
  });

  it('switches group by with one tap and asks for the plan of a Micro grouping', () => {
    renderPanel();
    fireEvent.press(screen.getByTestId('filter-panel-expand'));
    fireEvent.press(screen.getByTestId('filter-groupby-Week'));
    fireEvent.press(screen.getByTestId('filter-metric-Volume'));
    fireEvent.press(screen.getByTestId('filter-metric-Frequency'));
    fireEvent.press(screen.getByTestId('filter-panel-collapse'));
    expect(text('filter-groupby-summary')).toBe('Week · Volume, Frequency');

    fireEvent.press(screen.getByTestId('filter-panel-expand'));
    fireEvent.press(screen.getByTestId('filter-groupby-Micro'));
    fireEvent.press(screen.getByTestId('filter-groupby-plan-11'));
    fireEvent.press(screen.getByTestId('filter-panel-collapse'));
    expect(text('filter-groupby-summary')).toBe('Micro (Upper lower) · Volume, Frequency');
  });

  it('toggles muscles in the grid and clears them', () => {
    renderPanel();
    fireEvent.press(screen.getByTestId('filter-panel-expand'));
    fireEvent.press(screen.getByTestId('filter-muscle-Quads'));
    fireEvent.press(screen.getByTestId('filter-muscle-Back'));
    expect(text('filter-muscle-section-title')).toBe('Muscles (2)');
    expect(screen.getByTestId('filter-muscle-Quads')).toHaveAccessibilityState({selected: true});
    fireEvent.press(screen.getByTestId('filter-muscle-clear'));
    expect(text('filter-muscle-section-title')).toBe('Muscles (0)');
  });

  it('jumps to a range length ending today', () => {
    renderPanel({initialRange: new Range(new Date(2025, 0, 1), new Date(2025, 0, 10))});
    fireEvent.press(screen.getByTestId('filter-panel-expand'));
    expect(screen.getByTestId('filter-range-preset-custom')).toHaveAccessibilityState({selected: true});
    fireEvent.press(screen.getByTestId('filter-range-preset-4W'));
    expect(text('filter-range-label')).toBe('30 Sep – 27 Oct 2026');
    expect(screen.getByTestId('filter-range-preset-4W')).toHaveAccessibilityState({selected: true});
  });

  it('shows only exercises and muscles where the screen offers nothing else (History, Metrics)', () => {
    renderPanel({full: false});
    expect(screen.queryByTestId('filter-range-label')).toBeNull();
    expect(screen.queryByTestId('filter-groupby-summary')).toBeNull();
    fireEvent.press(screen.getByTestId('filter-panel-expand'));
    expect([screen.queryByTestId('filter-groupby-section'), screen.queryByTestId('filter-metrics-section'), screen.queryByTestId('filter-range-preset-4W')]).toEqual([null, null, null]);
    expect(screen.getByTestId('filter-muscle-section')).toBeTruthy();
  });

  it('searches all exercises in the sheet with Recent, checkboxes and "Done · N selected"', () => {
    renderPanel();
    fireEvent.press(screen.getByTestId('filter-panel-expand'));
    fireEvent.press(screen.getByTestId('filter-exercise-search-all'));
    const sheet = within(screen.getByTestId('exercise-search-sheet'));
    expect(sheet.getByTestId('exercise-search-recent-1')).toHaveTextContent('Squat2 days ago');
    expect(sheet.queryByTestId('exercise-search-recent-4')).toBeNull();
    fireEvent.changeText(sheet.getByTestId('exercise-search-bar'), 'cu');
    expect(sheet.queryByTestId('exercise-search-recent-1')).toBeNull();
    expect(sheet.queryByTestId('exercise-search-row-1')).toBeNull();
    fireEvent.press(sheet.getByTestId('exercise-search-row-4'));
    expect(sheet.getByTestId('exercise-search-row-4')).toHaveAccessibilityState({checked: true});
    expect(sheet.getByTestId('exercise-search-selected-4')).toHaveTextContent('Curl');
    expect(sheet.getByTestId('exercise-search-done')).toHaveTextContent('Done · 1 selected');
    fireEvent.press(sheet.getByTestId('exercise-search-done'));
    expect(text('filter-exercise-section-title')).toBe('Exercises (1)');
    // a selected exercise always gets a chip, even when it is no quick pick
    expect(screen.getByTestId('filter-exercise-chip-4')).toHaveAccessibilityState({selected: true});
  });
});
