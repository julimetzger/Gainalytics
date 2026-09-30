import {aggregateMetric, buildMetricSeries} from '../../app/utils/AnalyseSeries';
import {Metric} from '../../app/models/Metric';
import {Workout} from '../../app/models/entities/Workout';
import {Accumulation} from '../../app/components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../../app/models/AccumulationMode';

const workout = (id: number, exerciseId: number, start: Date, sets: {reps: number; weight: number}[]) =>
  ({id, exerciseId, start, end: start, sets: sets.map((s) => ({...s, rir: 0}))}) as unknown as Workout;

// Monday + Tuesday of one week, exercise 1 and 2
const monSquat = workout(1, 1, new Date(2026, 1, 16, 18), [
  {reps: 5, weight: 100},
  {reps: 5, weight: 80},
]);
const monBench = workout(2, 2, new Date(2026, 1, 16, 19), [{reps: 10, weight: 50}]);
const tueSquat = workout(3, 1, new Date(2026, 1, 17, 18), [{reps: 3, weight: 120}]);
const nextWeek = workout(4, 1, new Date(2026, 1, 23, 18), [{reps: 1, weight: 50}]);
const all = [monSquat, monBench, tueSquat, nextWeek];
const week = new Accumulation(AccumulationMode.WEEK);

describe('aggregateMetric (GH-468)', () => {
  it('sums volume, reps and sets over workouts and exercises', () => {
    expect(aggregateMetric([monSquat, monBench], Metric.VOLUME)).toBe(500 + 400 + 500);
    expect(aggregateMetric([monSquat, monBench], Metric.REPS)).toBe(20);
    expect(aggregateMetric([monSquat, monBench, tueSquat], Metric.SETS)).toBe(4);
  });

  it('takes the maximum for 1RM over all included sets', () => {
    const single = aggregateMetric([monSquat], Metric.ONE_RM);
    const both = aggregateMetric([monSquat, tueSquat], Metric.ONE_RM);
    expect(both).toBeCloseTo(120 * (1 + 3 / 30));
    expect(both).toBeGreaterThan(single);
  });

  it('takes the maximum for max intensity', () => {
    // one exercise, top set is the 1RM basis -> 100 %
    expect(aggregateMetric([monSquat], Metric.MAX_INTENSITY)).toBeCloseTo(100 * (100 / (100 * (1 + 5 / 30))) );
    // single-rep set is its own 1RM
    expect(aggregateMetric([nextWeek], Metric.MAX_INTENSITY)).toBe(100);
  });

  it('averages intensity over all sets, not summing or maxing the per-exercise values', () => {
    // squat 1RM = 100*(1+5/30)=116.67 ; sets 100 and 80 -> 85.71 %, 68.57 %
    // bench: one set of 50 -> 100 % of its own 1RM (per-exercise basis)... weight/oneRm = 50/(50*(1+10/30))
    const squatOneRm = 100 * (1 + 5 / 30);
    const benchOneRm = 50 * (1 + 10 / 30);
    const expected = ((100 / squatOneRm) * 100 + (80 / squatOneRm) * 100 + (50 / benchOneRm) * 100) / 3;
    expect(aggregateMetric([monSquat, monBench], Metric.AVERAGE_INTENSITY)).toBeCloseTo(expected);
  });

  it('counts distinct training days for frequency: two exercises on one day count once', () => {
    expect(aggregateMetric([monSquat, monBench], Metric.FREQUENCY)).toBe(1);
    expect(aggregateMetric([monSquat, monBench, tueSquat], Metric.FREQUENCY)).toBe(2);
  });

  it('ignores workouts without sets for frequency', () => {
    expect(aggregateMetric([workout(9, 1, new Date(2026, 1, 18), [])], Metric.FREQUENCY)).toBe(0);
  });
});

describe('buildMetricSeries (GH-468)', () => {
  it('accumulates per week across exercises', () => {
    const volume = buildMetricSeries(all, Metric.VOLUME, week);
    expect(volume.map((p) => p.y)).toEqual([500 + 400 + 500 + 360, 50]);
    const frequency = buildMetricSeries(all, Metric.FREQUENCY, week);
    expect(frequency.map((p) => p.y)).toEqual([2, 1]);
    const sets = buildMetricSeries(all, Metric.SETS, week);
    expect(sets.map((p) => p.y)).toEqual([4, 1]);
  });

  it('lists the workout ids behind a point so tapping it shows the trainings', () => {
    const [first] = buildMetricSeries(all, Metric.VOLUME, week);
    expect(first.id?.split(',').filter(Boolean).map(Number).sort()).toEqual([1, 2, 3]);
  });

  it('stays one point per day in day mode, with frequency 1 per trained day', () => {
    const series = buildMetricSeries(all, Metric.FREQUENCY, new Accumulation(AccumulationMode.SINGLE_DAY));
    expect(series.map((p) => p.y)).toEqual([1, 1, 1]);
  });

  it('returns an empty series without workouts', () => {
    expect(buildMetricSeries([], Metric.VOLUME, week)).toEqual([]);
  });
});
