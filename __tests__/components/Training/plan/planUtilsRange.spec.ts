import {PlanSetDraft} from '../../../../app/components/Training/plan/planTypes';
import {
  buildWorkoutSetFromDraft,
  getPlanDraftRangeError,
  getPlanRangeError,
  getPlanSetDraft,
  getQuickEditError,
  isPlanSetDraftValid,
} from '../../../../app/components/Training/plan/planUtils';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

// GH-63: the range validation rules. An upper bound below (or equal to) the
// lower bound must be refused with a message the user can act on, and clearing
// the upper bound must reset the field to a plain fixed value.

const draft = (overrides: Partial<PlanSetDraft> = {}): PlanSetDraft => ({
  reps: '8',
  rir: '1',
  weight: '100',
  repsMax: '',
  rirMax: '',
  weightMax: '',
  ...overrides,
});

describe('getPlanRangeError', () => {
  it('accepts an empty upper bound — the field simply stays a fixed value', () => {
    expect({
      reps: getPlanRangeError('reps', '8', ''),
      rir: getPlanRangeError('rir', '1', '   '),
      weight: getPlanRangeError('weight', '100', ''),
    }).toEqual({reps: undefined, rir: undefined, weight: undefined});
  });

  it('accepts an upper bound above the lower bound', () => {
    expect({
      reps: getPlanRangeError('reps', '8', '12'),
      rir: getPlanRangeError('rir', '1', '3'),
      weight: getPlanRangeError('weight', '100', '110'),
    }).toEqual({reps: undefined, rir: undefined, weight: undefined});
  });

  it('refuses an upper bound below the lower bound with a readable message', () => {
    expect(getPlanRangeError('reps', '8', '5')).toEqual('Reps range: the second value must be greater than 8.');
  });

  it('refuses an upper bound equal to the lower bound', () => {
    expect(getPlanRangeError('weight', '100', '100')).toEqual('Weight range: the second value must be greater than 100.');
  });

  it('explains the field rule when the upper bound is not a legal value at all', () => {
    expect({
      reps: getPlanRangeError('reps', '8', '120'),
      rir: getPlanRangeError('rir', '1', '99'),
      weight: getPlanRangeError('weight', '100', 'abc'),
    }).toEqual({
      reps: 'Reps must be a whole number from 1 to 99.',
      rir: 'RIR must be a whole number from 0 to 10.',
      weight: 'Weight must be between 0 and 999.9 kg in 0.25 steps.',
    });
  });

  it('reports the first broken range of a draft', () => {
    expect(getPlanDraftRangeError(draft({repsMax: '12', rirMax: '0'}))).toEqual(
      'RIR range: the second value must be greater than 1.',
    );
  });
});

describe('isPlanSetDraftValid', () => {
  it('accepts a draft without any range', () => {
    expect(isPlanSetDraftValid(draft())).toEqual(true);
  });

  it('accepts a draft with valid ranges on all three fields', () => {
    expect(isPlanSetDraftValid(draft({repsMax: '12', rirMax: '3', weightMax: '110'}))).toEqual(true);
  });

  it('rejects a draft with an inverted range', () => {
    expect(isPlanSetDraftValid(draft({repsMax: '4'}))).toEqual(false);
  });
});

describe('buildWorkoutSetFromDraft with ranges', () => {
  it('writes the upper bounds alongside the lower bounds', () => {
    expect(buildWorkoutSetFromDraft(draft({repsMax: '12', rirMax: '3', weightMax: '110'}), {index: 2, reps: 0, rir: 0, weight: 0})).toEqual({
      index: 2,
      reps: 8,
      rir: 1,
      weight: 100,
      repsMax: 12,
      rirMax: 3,
      weightMax: 110,
    });
  });

  it('produces a set without any range key when no range is entered', () => {
    const built = buildWorkoutSetFromDraft(draft(), {index: 2, reps: 0, rir: 0, weight: 0});
    expect(built).toEqual({index: 2, reps: 8, rir: 1, weight: 100});
    expect(Object.keys(built ?? {}).sort()).toEqual(['index', 'reps', 'rir', 'weight']);
  });

  it('resets an existing range back to a fixed value when the upper bound is cleared', () => {
    const existing: WorkoutSet = {index: 2, reps: 8, rir: 1, weight: 100, repsMax: 12, rirMax: 3, weightMax: 110};
    const built = buildWorkoutSetFromDraft(draft(), existing);
    expect(built).toEqual({index: 2, reps: 8, rir: 1, weight: 100});
    expect(Object.keys(built ?? {}).sort()).toEqual(['index', 'reps', 'rir', 'weight']);
  });

  it('refuses to build a set from an inverted range', () => {
    expect(buildWorkoutSetFromDraft(draft({weightMax: '90'}), {index: 2, reps: 0, rir: 0, weight: 0})).toEqual(null);
  });
});

describe('getPlanSetDraft', () => {
  it('reads the ranges of a planned set back into the edit draft', () => {
    expect(getPlanSetDraft({index: 1, reps: 8, rir: 1, weight: 102.5, repsMax: 12, weightMax: 107.5})).toEqual({
      reps: '8',
      rir: '1',
      weight: '102.5',
      repsMax: '12',
      rirMax: '',
      weightMax: '107.5',
    });
  });

  it('leaves the range fields empty for a fixed set', () => {
    expect(getPlanSetDraft({index: 1, reps: 8, rir: 1, weight: 100})).toEqual({
      reps: '8',
      rir: '1',
      weight: '100',
      repsMax: '',
      rirMax: '',
      weightMax: '',
    });
  });
});

describe('getQuickEditError', () => {
  const ranged: WorkoutSet = {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12};
  const fixed: WorkoutSet = {index: 1, reps: 8, rir: 1, weight: 100};

  it('accepts a lower bound below the existing upper bound', () => {
    expect(getQuickEditError(ranged, 'reps', '10')).toEqual(undefined);
  });

  it('refuses a lower bound that would reach or pass the upper bound', () => {
    expect({
      equal: getQuickEditError(ranged, 'reps', '12'),
      above: getQuickEditError(ranged, 'reps', '14'),
    }).toEqual({
      equal: 'Reps range: the first value must be less than 12.',
      above: 'Reps range: the first value must be less than 12.',
    });
  });

  it('behaves exactly like the plain field rule for a fixed set', () => {
    expect({
      ok: getQuickEditError(fixed, 'reps', '14'),
      bad: getQuickEditError(fixed, 'reps', '0'),
    }).toEqual({ok: undefined, bad: 'Reps must be a whole number from 1 to 99.'});
  });
});
