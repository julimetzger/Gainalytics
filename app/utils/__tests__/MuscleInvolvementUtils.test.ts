import {
  accumulateForExercise,
  accumulateForTraining,
  buildRows,
  computeGlobalMax,
  formatMetricValue,
} from '../MuscleInvolvementUtils';
import {Muscles} from '../../models/Muscles';
import {Exercise} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';

const exerciseBenchPress: Exercise = {
  id: 1,
  name: 'Bench Press',
  muscles: [
    {muscle: Muscles.CHEST, percent: 100},
    {muscle: Muscles.TRICEPS, percent: 50},
    {muscle: Muscles.SHOULDERS, percent: 50},
  ],
};

const exerciseRow: Exercise = {
  id: 2,
  name: 'Barbell Row',
  muscles: [
    {muscle: Muscles.BACK, percent: 100},
    {muscle: Muscles.BICEPS, percent: 50},
  ],
};

const workout3x10: Workout = {
  id: 10,
  exerciseId: 1,
  sets: [
    {reps: 10, weight: 100, rir: 2},
    {reps: 10, weight: 100, rir: 2},
    {reps: 10, weight: 100, rir: 2},
  ],
};

const workout4x5: Workout = {
  id: 11,
  exerciseId: 2,
  sets: [
    {reps: 5, weight: 80, rir: 2},
    {reps: 5, weight: 80, rir: 2},
    {reps: 5, weight: 80, rir: 2},
    {reps: 5, weight: 80, rir: 2},
  ],
};

describe('accumulateForExercise', () => {
  it('counts sets weighted by muscle percent', () => {
    const acc = new Map();
    accumulateForExercise(acc, exerciseBenchPress, workout3x10, 'sets');
    expect(acc.get(Muscles.CHEST)).toBeCloseTo(3, 5);
    expect(acc.get(Muscles.TRICEPS)).toBeCloseTo(1.5, 5);
    expect(acc.get(Muscles.SHOULDERS)).toBeCloseTo(1.5, 5);
  });

  it('computes volume in tonnes weighted by muscle percent', () => {
    const acc = new Map();
    accumulateForExercise(acc, exerciseBenchPress, workout3x10, 'volume');
    // 3 sets of 10x100kg = 3000 kg = 3 t for CHEST (100%); 1.5 t for TRICEPS/SHOULDERS (50%)
    expect(acc.get(Muscles.CHEST)).toBeCloseTo(3, 5);
    expect(acc.get(Muscles.TRICEPS)).toBeCloseTo(1.5, 5);
  });

  it('does nothing when exercise or workout is missing', () => {
    const acc = new Map();
    accumulateForExercise(acc, undefined, workout3x10, 'sets');
    accumulateForExercise(acc, exerciseBenchPress, undefined, 'sets');
    expect(acc.size).toBe(0);
  });

  it('skips muscles without a percent', () => {
    const acc = new Map();
    accumulateForExercise(
      acc,
      {id: 5, name: 'X', muscles: [{muscle: Muscles.CHEST, percent: 0}]},
      workout3x10,
      'sets',
    );
    expect(acc.size).toBe(0);
  });
});

describe('accumulateForTraining', () => {
  it('aggregates contributions across multiple exercises', () => {
    const totals = accumulateForTraining(
      [
        {exercise: exerciseBenchPress, workout: workout3x10},
        {exercise: exerciseRow, workout: workout4x5},
      ],
      'sets',
    );
    expect(totals.get(Muscles.CHEST)).toBeCloseTo(3, 5);
    expect(totals.get(Muscles.BACK)).toBeCloseTo(4, 5);
    expect(totals.get(Muscles.BICEPS)).toBeCloseTo(2, 5);
    expect(totals.get(Muscles.TRICEPS)).toBeCloseTo(1.5, 5);
  });
});

describe('buildRows', () => {
  it('sorts rows by today desc and includes only muscles touched today', () => {
    const today = new Map([
      [Muscles.CHEST, 3],
      [Muscles.TRICEPS, 1.5],
      [Muscles.BACK, 4],
    ]);
    const reference = new Map([
      [Muscles.CHEST, 6],
      [Muscles.GLUTES, 5], // not in today → excluded
    ]);
    const rows = buildRows(today, reference);
    expect(rows.map((r) => r.muscleGroupId)).toEqual([Muscles.BACK, Muscles.CHEST, Muscles.TRICEPS]);
    expect(rows.find((r) => r.muscleGroupId === Muscles.CHEST)?.reference).toBe(6);
    expect(rows.find((r) => r.muscleGroupId === Muscles.BACK)?.reference).toBe(0);
  });

  it('drops zero-today muscles', () => {
    const today = new Map([[Muscles.CHEST, 0]]);
    expect(buildRows(today, new Map())).toEqual([]);
  });
});

describe('computeGlobalMax', () => {
  it('takes the max across today and reference', () => {
    const rows = [
      {muscleGroupId: Muscles.CHEST, label: 'Chest', today: 3, reference: 8},
      {muscleGroupId: Muscles.BACK, label: 'Back', today: 5, reference: 4},
    ];
    expect(computeGlobalMax(rows)).toBe(8);
  });

  it('returns 0 for empty rows', () => {
    expect(computeGlobalMax([])).toBe(0);
  });
});

describe('formatMetricValue', () => {
  it('formats integer sets as int', () => {
    expect(formatMetricValue(3, 'sets')).toBe('3');
  });

  it('formats fractional sets to one decimal', () => {
    expect(formatMetricValue(1.5, 'sets')).toBe('1.5');
  });

  it('formats volume with t suffix', () => {
    expect(formatMetricValue(4.23, 'volume')).toBe('4.2t');
    expect(formatMetricValue(0, 'volume')).toBe('0.0t');
  });
});
