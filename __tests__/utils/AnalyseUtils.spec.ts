import {
  applyLinearProgressionToWorkout,
  calculateLinearProgressionWeight,
  calculateMetricValue,
  calculateMetricValueForMuscles,
  SuggestionProgressionProfile,
} from '../../app/utils/AnalyseUtils';
import {Workout} from '../../app/models/entities/Workout';
import {WorkoutSet} from '../../app/models/entities/WorkoutSet';
import {Metric} from '../../app/models/Metric';
import {Exercise} from '../../app/models/entities/Exercise';
import {Muscles} from '../../app/models/Muscles';

describe('AnalyseUtils linear progression helpers', () => {
  it('calculates progressed weight from the estimated 1RM formula and rounds to whole kilograms', () => {
    const sourceSet = {
      index: 1,
      reps: 5,
      rir: 2,
      weight: 100,
    } satisfies WorkoutSet;
    const progressionProfile = {
      rirDelta: 1,
      weightIncreasePercent: 5,
    } satisfies SuggestionProgressionProfile;

    expect(calculateLinearProgressionWeight(sourceSet, progressionProfile)).toBe(108);
  });

  it('applies linear progression while preserving set order and count', () => {
    const sourceWorkout = {
      id: 10,
      exerciseId: 7,
      notes: 'source',
      sets: [
        {index: 1, reps: 5, rir: 2, weight: 100},
        {index: 2, reps: 3, rir: 1, weight: 120},
      ],
    } satisfies Workout;
    const progressionProfile = {
      rirDelta: 1,
      weightIncreasePercent: 0,
    } satisfies SuggestionProgressionProfile;

    expect(applyLinearProgressionToWorkout(sourceWorkout, progressionProfile)).toEqual({
      id: 10,
      exerciseId: 7,
      notes: 'source',
      sets: [
        {index: 1, reps: 5, rir: 1, weight: 103},
        {index: 2, reps: 3, rir: 0, weight: 124},
      ],
    });
  });

  it('skips progression for an exercise when any source set already has rir 0', () => {
    const sourceWorkout = {
      id: 11,
      exerciseId: 8,
      notes: 'source',
      sets: [
        {index: 1, reps: 5, rir: 1, weight: 100},
        {index: 2, reps: 3, rir: 0, weight: 120},
      ],
    } satisfies Workout;
    const progressionProfile = {
      rirDelta: 1,
      weightIncreasePercent: 10,
    } satisfies SuggestionProgressionProfile;

    expect(applyLinearProgressionToWorkout(sourceWorkout, progressionProfile)).toEqual(sourceWorkout);
  });
});

describe('Frequency metric', () => {
  const sets: WorkoutSet[] = [
    {index: 1, reps: 5, rir: 2, weight: 100},
    {index: 2, reps: 3, rir: 1, weight: 120},
  ];

  it('calculateMetricValue returns workoutsCount for Frequency', () => {
    expect(calculateMetricValue(sets, Metric.FREQUENCY, 3)).toBe(3);
  });

  it('calculateMetricValue returns 0 for Frequency when workoutsCount is undefined', () => {
    expect(calculateMetricValue(sets, Metric.FREQUENCY, undefined)).toBe(0);
  });

  it('calculateMetricValueForMuscles aggregates Frequency weighted by muscle percent', () => {
    const exercise = {
      id: 1,
      name: 'Squat',
      muscles: [{muscle: Muscles.QUADRICEPS, percent: 60}],
    } as unknown as Exercise;

    const exerciseMap = new Map<Exercise, WorkoutSet[]>([[exercise, sets]]);
    const countMap = new Map<Exercise, number>([[exercise, 4]]);

    // 4 workouts * 60% = 2.4
    expect(calculateMetricValueForMuscles(exerciseMap, Metric.FREQUENCY, Muscles.QUADRICEPS, countMap)).toBeCloseTo(2.4);
  });

  it('calculateMetricValueForMuscles returns 0 Frequency when no counts provided', () => {
    const exercise = {
      id: 2,
      name: 'Bench',
      muscles: [{muscle: Muscles.CHEST, percent: 100}],
    } as unknown as Exercise;

    const exerciseMap = new Map<Exercise, WorkoutSet[]>([[exercise, sets]]);

    expect(calculateMetricValueForMuscles(exerciseMap, Metric.FREQUENCY, Muscles.CHEST, undefined)).toBe(0);
  });
});
