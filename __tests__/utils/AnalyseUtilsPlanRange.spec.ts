import {Metric} from '../../app/models/Metric';
import {Muscles} from '../../app/models/Muscles';
import {Exercise} from '../../app/models/entities/Exercise';
import {Workout} from '../../app/models/entities/Workout';
import {WorkoutSet} from '../../app/models/entities/WorkoutSet';
import {calculateMetricValue, calculateMetricValueForMuscles, repetitionMax} from '../../app/utils/AnalyseUtils';
import {accumulateForTraining} from '../../app/utils/MuscleInvolvementUtils';

// GH-63 — "a range counts with its lower bound" verified against raw numbers.
//
// Worked example used throughout (2 sets of one exercise):
//   set 1: 8-12 reps · RIR 1-3 · 100-110 kg
//   set 2: 6 reps · RIR 2 · 120 kg   (no range)
//
// Expected, counting the LOWER bound of every range:
//   VOLUME = 100*8 + 120*6 = 800 + 720 = 1520
//   REPS   = 8 + 6 = 14
//   SETS   = 2
//   ONE_RM = max(100 * (1 + (8+1)/30), 120 * (1 + (6+2)/30)) = max(130, 152) = 152
// The same two sets with the ranges removed must produce identical numbers.

const rangedSets: WorkoutSet[] = [
  {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12, rirMax: 3, weightMax: 110},
  {index: 2, reps: 6, rir: 2, weight: 120},
];

const fixedSets: WorkoutSet[] = [
  {index: 1, reps: 8, rir: 1, weight: 100},
  {index: 2, reps: 6, rir: 2, weight: 120},
];

const metricsOf = (sets: WorkoutSet[]) => ({
  volume: calculateMetricValue(sets, Metric.VOLUME),
  reps: calculateMetricValue(sets, Metric.REPS),
  sets: calculateMetricValue(sets, Metric.SETS),
  oneRm: calculateMetricValue(sets, Metric.ONE_RM),
  maxIntensity: calculateMetricValue(sets, Metric.MAX_INTENSITY),
  averageIntensity: calculateMetricValue(sets, Metric.AVERAGE_INTENSITY),
});

describe('calculateMetricValue with planned ranges (GH-63)', () => {
  it('counts every range with its lower bound, matching the hand-computed raw numbers', () => {
    expect({
      volume: calculateMetricValue(rangedSets, Metric.VOLUME),
      reps: calculateMetricValue(rangedSets, Metric.REPS),
      sets: calculateMetricValue(rangedSets, Metric.SETS),
      oneRm: calculateMetricValue(rangedSets, Metric.ONE_RM),
    }).toEqual({volume: 1520, reps: 14, sets: 2, oneRm: 152});
  });

  it('produces the exact numbers the same sets produce without any range', () => {
    expect(metricsOf(rangedSets)).toEqual(metricsOf(fixedSets));
  });

  it('ignores the upper bound in the estimated 1RM', () => {
    // The upper bound (110 kg × 12 reps) would give a far higher 1RM.
    expect(repetitionMax(rangedSets[0])).toEqual(130);
  });
});

describe('per-muscle metrics with planned ranges (GH-63)', () => {
  const exercise: Exercise = {
    id: 1,
    name: 'Squat',
    muscles: [{muscle: Muscles.QUADS, percent: 100}],
    alternativeIds: [],
  } as unknown as Exercise;

  it('counts the lower bound for volume and reps per muscle', () => {
    const rangedMap = new Map<Exercise, WorkoutSet[]>([[exercise, rangedSets]]);
    const fixedMap = new Map<Exercise, WorkoutSet[]>([[exercise, fixedSets]]);

    expect({
      volume: calculateMetricValueForMuscles(rangedMap, Metric.VOLUME, Muscles.QUADS),
      reps: calculateMetricValueForMuscles(rangedMap, Metric.REPS, Muscles.QUADS),
    }).toEqual({
      volume: calculateMetricValueForMuscles(fixedMap, Metric.VOLUME, Muscles.QUADS),
      reps: calculateMetricValueForMuscles(fixedMap, Metric.REPS, Muscles.QUADS),
    });
  });

  it('counts the lower bound in the muscle map tonnage', () => {
    const rangedWorkout = {id: 1, exerciseId: 1, sets: rangedSets} as Workout;
    const fixedWorkout = {id: 1, exerciseId: 1, sets: fixedSets} as Workout;

    const rangedTotals = accumulateForTraining([{exercise, workout: rangedWorkout}], 'volume');
    const fixedTotals = accumulateForTraining([{exercise, workout: fixedWorkout}], 'volume');

    // 1520 kg → 1.52 tonnes at 100 % muscle involvement.
    expect({ranged: rangedTotals.get(Muscles.QUADS), fixed: fixedTotals.get(Muscles.QUADS)}).toEqual({
      ranged: 1.52,
      fixed: 1.52,
    });
  });
});
