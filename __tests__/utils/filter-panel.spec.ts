import {Range} from '../../app/components/picker/date/DateRangePicker';
import {Accumulation} from '../../app/models/Accumulation';
import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Exercise} from '../../app/models/entities/Exercise';
import {Metric} from '../../app/models/Metric';
import {TrainingsPlan} from '../../app/models/entities/TrainingsPlan';
import {
  canStepForward,
  filterExercisesByName,
  formatAgo,
  formatGroupByAndMetrics,
  formatRangeLabel,
  formatSelectionSummary,
  presetOfRange,
  quickPickExercises,
  rangeForPreset,
  recentExercises,
  stepRangeForward,
  toggleExercise,
} from '../../app/utils/filter-panel';
import {buildExerciseTrainingStats} from '../../app/redux/Workout/use/useExerciseTrainingStats';
import {swipeIntent} from '../../app/components/picker/filter/SwipeStepArea';

const exercise = (id: number, name: string) => ({id, name, muscles: []}) satisfies Exercise;
const squat = exercise(1, 'Squat');
const bench = exercise(2, 'Bench Press');
const deadlift = exercise(3, 'Deadlift');
const row = exercise(4, 'Barbell Row');

const TODAY = new Date(2026, 9, 27, 14, 30);

describe('range presets (GH-642)', () => {
  it('builds a 3M range ending today, e.g. 28 Jul – 27 Oct 2026', () => {
    const range = rangeForPreset('3M', TODAY);
    expect({start: range.startDate, end: range.endDate}).toEqual({start: new Date(2026, 6, 28), end: new Date(2026, 9, 27, 23, 59, 59)});
    expect(formatRangeLabel(range)).toBe('28 Jul – 27 Oct 2026');
  });

  it('builds 4W as the last 28 days including today', () => {
    const range = rangeForPreset('4W', TODAY);
    expect({start: range.startDate, end: range.endDate}).toEqual({start: new Date(2026, 8, 30), end: new Date(2026, 9, 27, 23, 59, 59)});
  });

  it('recognizes every preset and the default "3 months to the end of the week" range', () => {
    expect((['4W', '3M', '6M', '1Y'] as const).map((preset) => presetOfRange(rangeForPreset(preset, TODAY)))).toEqual(['4W', '3M', '6M', '1Y']);
    expect(presetOfRange(new Range(new Date(2026, 6, 26), new Date(2026, 10, 1, 23, 59, 59)))).toBe('3M');
    expect(presetOfRange(new Range(new Date(2026, 9, 1), new Date(2026, 9, 10)))).toBeUndefined();
  });

  it('keeps the start year in the label when the range spans a year change', () => {
    expect(formatRangeLabel(new Range(new Date(2025, 11, 1), new Date(2026, 2, 1)))).toBe('1 Dec 2025 – 1 Mar 2026');
  });
});

describe('range stepping (GH-642)', () => {
  it('cannot step forward from a range that already ends today or later', () => {
    expect(canStepForward(rangeForPreset('3M', TODAY), TODAY)).toBe(false);
    expect(canStepForward(new Range(new Date(2026, 5, 1), new Date(2026, 8, 1)), TODAY)).toBe(true);
  });

  it('clamps a forward step to end today and keeps the length', () => {
    const range = new Range(new Date(2026, 8, 1), new Date(2026, 9, 1, 23, 59, 59));
    const next = stepRangeForward(range, TODAY);
    expect({end: next.endDate, length: next.endDate.getTime() - next.startDate.getTime()}).toEqual({end: new Date(2026, 9, 27, 23, 59, 59), length: range.endDate.getTime() - range.startDate.getTime()});
  });

  it('steps a full period forward when that stays before today', () => {
    const range = new Range(new Date(2026, 0, 1), new Date(2026, 0, 31, 23, 59, 59));
    expect(stepRangeForward(range, TODAY)).toEqual(range.plusOneRange());
  });
});

describe('swipeIntent (GH-642)', () => {
  it('separates swipe left, swipe right, tap, scroll and an undecided drag', () => {
    expect([swipeIntent(-80, 5), swipeIntent(80, -5), swipeIntent(3, 4), swipeIntent(30, 120), swipeIntent(20, 0)]).toEqual(['next', 'previous', 'tap', undefined, undefined]);
  });
});

describe('summary lines (GH-642)', () => {
  it('lists exercises and muscles, or "All exercises"', () => {
    expect([formatSelectionSummary([squat, bench], ['Quads']), formatSelectionSummary([], ['Quads']), formatSelectionSummary([], [])]).toEqual(['Squat, Bench Press · Quads', 'Quads', 'All exercises']);
  });

  it('shows group by and metrics, "All metrics" when none is picked and the plan for Micro', () => {
    const plan = {id: 5, name: 'Push pull'} as unknown satisfies Partial<TrainingsPlan>;
    expect([
      formatGroupByAndMetrics(new Accumulation(AccumulationMode.WEEK), [Metric.VOLUME, Metric.FREQUENCY]),
      formatGroupByAndMetrics(new Accumulation(AccumulationMode.SINGLE_DAY), []),
      formatGroupByAndMetrics(new Accumulation(AccumulationMode.WEEK), undefined),
      formatGroupByAndMetrics(Accumulation.fromTrainingsPlan(plan as TrainingsPlan), undefined),
    ]).toEqual(['Week · Volume, Frequency', 'Day · All metrics', 'Week', 'Micro (Push pull)']);
  });
});

describe('exercise picks (GH-642)', () => {
  const stats = {1: {count: 10, last: 100}, 2: {count: 7, last: 300}, 3: {count: 2, last: 200}};

  it('offers the most trained first, then selected ones that are not among them', () => {
    expect(quickPickExercises([squat, bench, deadlift, row], stats, [row], 2)).toEqual([squat, bench, row]);
  });

  it('lists recent exercises newest first and skips untrained ones', () => {
    expect(recentExercises([squat, bench, deadlift, row], stats)).toEqual([bench, deadlift, squat]);
  });

  it('filters by name case-insensitively and sorts A–Z', () => {
    expect(filterExercisesByName([squat, bench, row, deadlift], 'b')).toEqual([row, bench]);
  });

  it('toggles by id and keeps the order', () => {
    expect([toggleExercise([squat], bench), toggleExercise([squat, bench], squat)]).toEqual([[squat, bench], [bench]]);
  });

  it('counts only workouts with logged sets and keeps the newest date', () => {
    const workouts = {
      allIds: [1, 2, 3],
      byId: {
        1: {id: 1, exerciseId: 1, start: new Date(1000), sets: [{reps: 5, weight: 100}]},
        2: {id: 2, exerciseId: 1, start: new Date(5000), sets: [{reps: 5, weight: 100}]},
        3: {id: 3, exerciseId: 2, start: new Date(9000), sets: []},
      },
    };
    expect(buildExerciseTrainingStats(workouts as never)).toEqual({1: {count: 2, last: 5000}});
  });
});

describe('formatAgo (GH-642)', () => {
  it('reads like "2 days ago"', () => {
    const at = (days: number) => new Date(2026, 9, 27 - days, 9);
    expect([0, 1, 2, 13, 20, 45, 100, 800].map((days) => formatAgo(at(days), TODAY))).toEqual(['today', 'yesterday', '2 days ago', '13 days ago', '2 weeks ago', '6 weeks ago', '3 months ago', '2 years ago']);
  });
});
