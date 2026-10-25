import bodyWeightReducer, {initialBodyWeightState} from '../bodyWeightReducer';
import fullStateReducer from '../../fullstateactions/fullStateReducer';
import {selectBodyWeightEntries} from '../use/useBodyWeightEntries';
import {GlobalState} from '../../rootReducer';
import {migrations} from '../../../../configureStore';

const DAY = 24 * 60 * 60 * 1000;
const BASE = new Date(2026, 0, 1).getTime();

describe('bodyWeightReducer', () => {
  it('adds entries with increasing ids', () => {
    const first = bodyWeightReducer(initialBodyWeightState, {type: 'ADD_BODY_WEIGHT_ENTRY', entry: {date: BASE, weightKg: 80}});
    const second = bodyWeightReducer(first, {type: 'ADD_BODY_WEIGHT_ENTRY', entry: {date: BASE + DAY, weightKg: 79.5, note: 'morning'}});

    expect(second).toEqual({
      byId: {
        1: {id: 1, date: BASE, weightKg: 80},
        2: {id: 2, date: BASE + DAY, weightKg: 79.5, note: 'morning'},
      },
      allIds: [1, 2],
    });
  });

  it('edits an entry and drops a removed note', () => {
    const state = {byId: {1: {id: 1, date: BASE, weightKg: 80, note: 'x'}}, allIds: [1]};
    const edited = bodyWeightReducer(state, {type: 'EDIT_BODY_WEIGHT_ENTRY', entry: {id: 1, date: BASE + DAY, weightKg: 81}});

    expect(edited).toEqual({byId: {1: {id: 1, date: BASE + DAY, weightKg: 81}}, allIds: [1]});
    expect(state.byId[1].weightKg).toBe(80);
  });

  it('ignores edits and deletes of unknown ids', () => {
    expect(bodyWeightReducer(initialBodyWeightState, {type: 'EDIT_BODY_WEIGHT_ENTRY', entry: {id: 5, date: BASE, weightKg: 80}})).toBe(initialBodyWeightState);
    expect(bodyWeightReducer(initialBodyWeightState, {type: 'DELETE_BODY_WEIGHT_ENTRY', entryId: 5})).toBe(initialBodyWeightState);
  });

  it('deletes an entry', () => {
    const state = {
      byId: {
        1: {id: 1, date: BASE, weightKg: 80},
        2: {id: 2, date: BASE + DAY, weightKg: 79},
      },
      allIds: [1, 2],
    };

    expect(bodyWeightReducer(state, {type: 'DELETE_BODY_WEIGHT_ENTRY', entryId: 1})).toEqual({byId: {2: {id: 2, date: BASE + DAY, weightKg: 79}}, allIds: [2]});
  });
});

describe('selectBodyWeightEntries', () => {
  it('returns entries newest first and a stable empty array', () => {
    const state = {
      bodyWeight: {
        byId: {
          1: {id: 1, date: BASE, weightKg: 80},
          2: {id: 2, date: BASE + 2 * DAY, weightKg: 78},
          3: {id: 3, date: BASE + DAY, weightKg: 79},
        },
        allIds: [1, 2, 3],
      },
    } as unknown as GlobalState;

    expect(selectBodyWeightEntries(state).map((entry) => entry.id)).toEqual([2, 3, 1]);
    expect(selectBodyWeightEntries({bodyWeight: initialBodyWeightState} as unknown as GlobalState)).toBe(selectBodyWeightEntries({} as GlobalState));
  });
});

describe('body weight in .gains import / export and persistence', () => {
  const baseState = {
    exercises: {byId: {}, allIds: []},
    workouts: {byId: {}, plannedWorkouts: [], byExerciseId: {}, allIds: []},
    trainings: {byId: {}, allIds: []},
    trainingsPlan: {byId: {}, allIds: []},
    settings: {mode: 'dark'},
    effects: {},
  };

  it('restores body weight entries from an export (JSON round trip)', () => {
    const bodyWeight = {byId: {1: {id: 1, date: BASE, weightKg: 80.5, note: 'test'}}, allIds: [1]};
    const exported = JSON.parse(JSON.stringify({...baseState, bodyWeight}));

    const imported = fullStateReducer({...baseState, bodyWeight: initialBodyWeightState} as unknown as GlobalState, {type: 'FULL_IMPORT', state: exported});

    expect(imported.bodyWeight).toEqual(bodyWeight);
  });

  it('imports an older .gains file without body weight data as an empty slice', () => {
    const current = {...baseState, bodyWeight: {byId: {1: {id: 1, date: BASE, weightKg: 80}}, allIds: [1]}} as unknown as GlobalState;

    const imported = fullStateReducer(current, {type: 'FULL_IMPORT', state: baseState});

    expect(imported.bodyWeight).toEqual(initialBodyWeightState);
  });

  it('migration 14 adds an empty slice and keeps an existing one', () => {
    expect(migrations[14]({exercises: 'kept'})).toEqual({exercises: 'kept', bodyWeight: {byId: {}, allIds: []}});
    const existing = {byId: {1: {id: 1, date: BASE, weightKg: 80}}, allIds: [1]};
    expect(migrations[14]({bodyWeight: existing}).bodyWeight).toBe(existing);
  });
});
