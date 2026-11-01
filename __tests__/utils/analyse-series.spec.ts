import {aggregateMetric, buildMetricSeries, MetricPoint, selectionWeight} from '../../app/utils/analyse-series';
import {Metric} from '../../app/models/Metric';
import {Workout} from '../../app/models/entities/Workout';
import {Accumulation} from '../../app/models/Accumulation';
import {AccumulationMode} from '../../app/models/AccumulationMode';
import {Exercise} from '../../app/models/entities/Exercise';
import {Muscles} from '../../app/models/Muscles';

const workout = (id: number, exerciseId: number, start: Date, sets: {reps: number; weight: number}[]) =>
  ({id, exerciseId, start, end: start, sets: sets.map((s) => ({...s, rir: 0}))} satisfies Workout);

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
    expect(aggregateMetric([monSquat], Metric.MAX_INTENSITY)).toBeCloseTo(100 * (100 / (100 * (1 + 5 / 30))));
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

// Full chart point: `id` lists the workouts behind it in bucket order, `x` is the bucket start.
const point = (workoutIds: number[], bucketStart: Date, y: number): MetricPoint => ({
  id: workoutIds.map((it) => ',' + it).join(''),
  x: bucketStart.getTime(),
  y,
  marker: y.toFixed(2),
});
const week1 = new Date(2026, 1, 16);
const week2 = new Date(2026, 1, 23);

describe('buildMetricSeries (GH-468)', () => {
  it('sums volume per week across exercises', () => {
    expect(buildMetricSeries(all, Metric.VOLUME, week)).toEqual([point([1, 2, 3], week1, 500 + 400 + 500 + 360), point([4], week2, 50)]);
  });

  it('counts distinct training days per week for frequency', () => {
    expect(buildMetricSeries(all, Metric.FREQUENCY, week)).toEqual([point([1, 2, 3], week1, 2), point([4], week2, 1)]);
  });

  it('sums sets per week', () => {
    expect(buildMetricSeries(all, Metric.SETS, week)).toEqual([point([1, 2, 3], week1, 4), point([4], week2, 1)]);
  });

  it('stays one point per day in day mode, with frequency 1 per trained day', () => {
    expect(buildMetricSeries(all, Metric.FREQUENCY, new Accumulation(AccumulationMode.SINGLE_DAY))).toEqual([
      point([1, 2], new Date(2026, 1, 16), 1),
      point([3], new Date(2026, 1, 17), 1),
      point([4], new Date(2026, 1, 23), 1),
    ]);
  });

  it('returns an empty series without workouts', () => {
    expect(buildMetricSeries([], Metric.VOLUME, week)).toEqual([]);
  });
});

// exercise 1 (squat): 60 % quads, 30 % glutes; exercise 2 (bench): 20 % triceps
const squat = {
  id: 1,
  name: 'Squat',
  muscles: [
    {muscle: Muscles.QUADS, percent: 60},
    {muscle: Muscles.GLUTES, percent: 30},
  ],
} satisfies Exercise;
const bench = {
  id: 2,
  name: 'Bench',
  muscles: [
    {muscle: Muscles.CHEST, percent: 70},
    {muscle: Muscles.TRICEPS, percent: 20},
  ],
} satisfies Exercise;

describe('muscle shares (GH-468 round 3)', () => {
  it('counts every workout fully without a selection', () => {
    const weightOf = selectionWeight([], [], []);
    expect(aggregateMetric([monSquat, monBench], Metric.VOLUME, weightOf)).toBe(1400);
  });

  it('weights volume, reps and sets by the selected muscle share', () => {
    const weightOf = selectionWeight([], [Muscles.TRICEPS], [bench]);
    // bench 10 x 50 = 500 volume, 10 reps, 1 set -> 20 % of each; squat is not a triceps exercise
    expect(aggregateMetric([monSquat, monBench], Metric.VOLUME, weightOf)).toBeCloseTo(100);
    expect(aggregateMetric([monSquat, monBench], Metric.REPS, weightOf)).toBeCloseTo(2);
    expect(aggregateMetric([monSquat, monBench], Metric.SETS, weightOf)).toBeCloseTo(0.2);
  });

  it('adds the shares of several selected muscles of one exercise', () => {
    const weightOf = selectionWeight([], [Muscles.QUADS, Muscles.GLUTES], [squat]);
    expect(aggregateMetric([monSquat], Metric.VOLUME, weightOf)).toBeCloseTo(900 * 0.9);
  });

  it('counts an explicitly selected exercise fully, even if a selected muscle covers it too', () => {
    const weightOf = selectionWeight([bench], [Muscles.TRICEPS, Muscles.QUADS], [squat, bench]);
    expect(aggregateMetric([monSquat, monBench], Metric.VOLUME, weightOf)).toBeCloseTo(900 * 0.6 + 500);
  });

  it('keeps 1RM, max intensity and frequency unweighted for a muscle selection', () => {
    const weightOf = selectionWeight([], [Muscles.TRICEPS], [bench]);
    expect(aggregateMetric([monSquat, monBench], Metric.ONE_RM, weightOf)).toBeCloseTo(50 * (1 + 10 / 30));
    // the bench set is measured against its own (estimated) 1RM: 50 / 66.67 -> 75 %, not 20 % of it
    expect(aggregateMetric([monSquat, monBench], Metric.MAX_INTENSITY, weightOf)).toBeCloseTo(75);
    expect(aggregateMetric([monSquat, monBench], Metric.FREQUENCY, weightOf)).toBe(1);
  });

  it('weights the average intensity by share', () => {
    const weightOf = selectionWeight([], [Muscles.QUADS, Muscles.TRICEPS], [squat, bench]);
    const squatOneRm = 100 * (1 + 5 / 30);
    const benchOneRm = 50 * (1 + 10 / 30);
    const expected = ((100 / squatOneRm) * 100 * 0.6 + (80 / squatOneRm) * 100 * 0.6 + (50 / benchOneRm) * 100 * 0.2) / (0.6 + 0.6 + 0.2);
    expect(aggregateMetric([monSquat, monBench], Metric.AVERAGE_INTENSITY, weightOf)).toBeCloseTo(expected);
  });

  it('applies the shares inside each accumulation bucket and drops exercises without share', () => {
    const weightOf = selectionWeight([], [Muscles.QUADS], [squat]);
    // bench (workout 2) has no quads share and is not part of the point
    expect(buildMetricSeries(all, Metric.VOLUME, week, weightOf)).toEqual([
      {...point([1, 3], week1, 756), y: expect.closeTo((500 + 400 + 360) * 0.6)},
      {...point([4], week2, 30), y: expect.closeTo(50 * 0.6)},
    ]);
  });
});
