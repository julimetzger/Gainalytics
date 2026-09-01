import {WorkoutSet} from '../../app/models/entities/WorkoutSet';
import {
  describePlannedSet,
  evaluationReps,
  evaluationRir,
  evaluationWeight,
  formatPlanFieldValue,
  getPlanRangeMax,
  hasAnyPlanRange,
  hasPlanRange,
  planRangeMaxField,
  toEvaluationSet,
  withPlanRangeMax,
} from '../../app/utils/planRange';

// GH-63: planned sets may express reps/RIR/weight as a range. The rule that a
// range counts with its LOWER bound lives in app/utils/planRange and is pinned
// here so no evaluation can quietly re-implement it differently.

const fixedSet: WorkoutSet = {index: 1, reps: 8, rir: 2, weight: 100};
const rangedSet: WorkoutSet = {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12, rirMax: 3, weightMax: 110};

describe('planRange field access', () => {
  it('maps every planned field to its upper-bound key', () => {
    expect({
      reps: planRangeMaxField('reps'),
      rir: planRangeMaxField('rir'),
      weight: planRangeMaxField('weight'),
    }).toEqual({reps: 'repsMax', rir: 'rirMax', weight: 'weightMax'});
  });

  it('reports no range for a set that only has fixed values', () => {
    expect({
      reps: getPlanRangeMax(fixedSet, 'reps'),
      rir: getPlanRangeMax(fixedSet, 'rir'),
      weight: getPlanRangeMax(fixedSet, 'weight'),
      any: hasAnyPlanRange(fixedSet),
    }).toEqual({reps: undefined, rir: undefined, weight: undefined, any: false});
  });

  it('reports the stored upper bound for a ranged set', () => {
    expect({
      reps: getPlanRangeMax(rangedSet, 'reps'),
      rir: getPlanRangeMax(rangedSet, 'rir'),
      weight: getPlanRangeMax(rangedSet, 'weight'),
      any: hasAnyPlanRange(rangedSet),
    }).toEqual({reps: 12, rir: 3, weight: 110, any: true});
  });

  it('degrades an inverted or equal upper bound to "no range"', () => {
    const broken: WorkoutSet = {index: 1, reps: 8, rir: 2, weight: 100, repsMax: 5, weightMax: 100};
    expect({
      reps: hasPlanRange(broken, 'reps'),
      weight: hasPlanRange(broken, 'weight'),
      any: hasAnyPlanRange(broken),
    }).toEqual({reps: false, weight: false, any: false});
  });

  it('treats an undefined set as range-free', () => {
    expect({max: getPlanRangeMax(undefined, 'reps'), any: hasAnyPlanRange(undefined)}).toEqual({
      max: undefined,
      any: false,
    });
  });
});

describe('planRange evaluation rule', () => {
  it('counts a range with its lower bound', () => {
    expect({
      reps: evaluationReps(rangedSet),
      rir: evaluationRir(rangedSet),
      weight: evaluationWeight(rangedSet),
    }).toEqual({reps: 8, rir: 1, weight: 100});
  });

  it('returns the plain value for a fixed set', () => {
    expect({
      reps: evaluationReps(fixedSet),
      rir: evaluationRir(fixedSet),
      weight: evaluationWeight(fixedSet),
    }).toEqual({reps: 8, rir: 2, weight: 100});
  });

  it('strips the bounds from a ranged set', () => {
    expect(toEvaluationSet(rangedSet)).toEqual({index: 1, reps: 8, rir: 1, weight: 100});
  });

  it('leaves a fixed set untouched, reference included', () => {
    expect(toEvaluationSet(fixedSet)).toBe(fixedSet);
  });
});

describe('planRange formatting', () => {
  it('formats a fixed value without a range', () => {
    expect({
      reps: formatPlanFieldValue(fixedSet, 'reps'),
      rir: formatPlanFieldValue(fixedSet, 'rir'),
      weight: formatPlanFieldValue(fixedSet, 'weight'),
    }).toEqual({reps: '8', rir: '2', weight: '100'});
  });

  it('formats a range as "from-to"', () => {
    expect({
      reps: formatPlanFieldValue(rangedSet, 'reps'),
      rir: formatPlanFieldValue(rangedSet, 'rir'),
      weight: formatPlanFieldValue(rangedSet, 'weight'),
    }).toEqual({reps: '8-12', rir: '1-3', weight: '100-110'});
  });

  it('drops trailing zeroes from fractional weights', () => {
    const set: WorkoutSet = {index: 1, reps: 5, rir: 0, weight: 102.5, weightMax: 107.5};
    expect(formatPlanFieldValue(set, 'weight')).toEqual('102.5-107.5');
  });

  it('describes a ranged planned set as one readable target', () => {
    expect(describePlannedSet(rangedSet)).toEqual('8-12 reps · RIR 1-3 · 100-110 kg');
  });

  it('describes a fixed planned set exactly like before', () => {
    expect(describePlannedSet(fixedSet)).toEqual('8 reps · RIR 2 · 100 kg');
  });
});

describe('withPlanRangeMax', () => {
  it('adds an upper bound', () => {
    expect(withPlanRangeMax(fixedSet, 'reps', 12)).toEqual({index: 1, reps: 8, rir: 2, weight: 100, repsMax: 12});
  });

  it('removes the key entirely when the range is reset to a fixed value', () => {
    const reset = withPlanRangeMax(rangedSet, 'reps', undefined);
    expect(Object.prototype.hasOwnProperty.call(reset, 'repsMax')).toEqual(false);
    expect(reset).toEqual({index: 1, reps: 8, rir: 1, weight: 100, rirMax: 3, weightMax: 110});
  });

  it('keeps the same reference when there is nothing to remove', () => {
    expect(withPlanRangeMax(fixedSet, 'reps', undefined)).toBe(fixedSet);
  });
});
