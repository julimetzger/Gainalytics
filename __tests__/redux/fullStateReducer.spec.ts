import fullStateReducer from '../../app/redux/fullstateactions/fullStateReducer';
import {GlobalState} from '../../app/redux/rootReducer';

const baseState: Partial<GlobalState> = {
  exercises: {byId: {}, allIds: []} as any,
  workouts: {byId: {}, allIds: []} as any,
  trainingsPlan: {byId: {}, allIds: []} as any,
  trainings: {byId: {}, allIds: []} as any,
  videoAnalyses: {byId: {}, allIds: []} as any,
  settings: {} as any,
  effects: {} as any,
  aiChat: {messages: [{role: 'user', content: 'existing chat'}], isLoading: false, error: null, seedContextJson: null, contextRange: null},
};

describe('fullStateReducer FULL_IMPORT (GH-361)', () => {
  it('falls back to the current aiChat state when the imported backup predates the AI Chat feature', () => {
    const importedState = {
      exercises: {byId: {}, allIds: []},
      workouts: {byId: {}, allIds: []},
      trainingsPlan: {byId: {}, allIds: []},
      trainings: {byId: {}, allIds: []},
      settings: {},
      effects: {},
      // no `aiChat` key — simulates an older .gains export captured before GH-157 shipped
    };

    const result = fullStateReducer(baseState as GlobalState, {type: 'FULL_IMPORT', state: importedState});

    expect(result.aiChat).toEqual(baseState.aiChat);
  });

  it('uses the imported aiChat state when the backup file already contains one', () => {
    const importedAiChat = {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null};
    const importedState = {
      exercises: {byId: {}, allIds: []},
      workouts: {byId: {}, allIds: []},
      trainingsPlan: {byId: {}, allIds: []},
      trainings: {byId: {}, allIds: []},
      settings: {},
      effects: {},
      aiChat: importedAiChat,
    };

    const result = fullStateReducer(baseState as GlobalState, {type: 'FULL_IMPORT', state: importedState});

    expect(result.aiChat).toEqual(importedAiChat);
  });
});

/**
 * GH-316: the VL reference is a personal calibration. A full `.gains` backup is the user's
 * own data and must round-trip it; a shared plan belongs to someone else and must not.
 */
describe('fullStateReducer and the VL reference (GH-316)', () => {
  const SQUAT_REFERENCE = {
    rir: 1,
    velocityLossPercent: 28,
    referencedAt: '2026-03-15T10:00:00.000Z',
    analysisId: 7,
    workoutId: 100,
    setIndex: 1,
  };

  it('restores the VL reference from a full backup', () => {
    const importedState = {
      exercises: {byId: {2: {id: 2, name: 'Squat', muscles: [], vlReference: SQUAT_REFERENCE}}, allIds: [2]},
      workouts: {byId: {}, allIds: []},
      trainingsPlan: {byId: {}, allIds: []},
      trainings: {byId: {}, allIds: []},
      settings: {},
      effects: {},
    };

    const result = fullStateReducer(baseState as GlobalState, {type: 'FULL_IMPORT', state: importedState});

    expect(result.exercises.byId[2].vlReference).toEqual(SQUAT_REFERENCE);
  });

  it('drops a VL reference carried by a shared trainings plan instead of installing it on the new exercise', () => {
    const payload = {
      trainingsPlan: {id: 99, name: 'Strength', trainings: {'1:1': 1}, trainingNames: {}},
      trainings: [{id: 1, state: 'PLANNED', plannedWorkouts: {10: 100}, doneWorkoutIds: {}, exercises: [10]}],
      // A plan file exported before the fix still carries the sender's reference.
      exercises: [{id: 10, name: 'Squat', muscles: [], vlReference: SQUAT_REFERENCE}],
      workouts: [{id: 100, exerciseId: 10, sets: []}],
    };

    const result = fullStateReducer(baseState as GlobalState, {type: 'IMPORT_TRAININGS_PLAN', payload});

    const imported = Object.values(result.exercises.byId).find((exercise) => exercise.name === 'Squat');
    expect(imported).toBeDefined();
    expect(imported!.vlReference).toBeUndefined();
    expect(Object.keys(imported!)).not.toContain('vlReference');
  });

  it('leaves the recipient own VL reference untouched when the plan reuses an existing exercise', () => {
    const ownReference = {...SQUAT_REFERENCE, velocityLossPercent: 41, analysisId: 3};
    const stateWithOwnReference = {
      ...baseState,
      exercises: {byId: {2: {id: 2, name: 'Squat', muscles: [], vlReference: ownReference}}, allIds: [2]},
    } as GlobalState;

    const payload = {
      trainingsPlan: {id: 99, name: 'Strength', trainings: {'1:1': 1}, trainingNames: {}},
      trainings: [{id: 1, state: 'PLANNED', plannedWorkouts: {10: 100}, doneWorkoutIds: {}, exercises: [10]}],
      exercises: [{id: 10, name: 'squat', muscles: [], vlReference: SQUAT_REFERENCE}],
      workouts: [{id: 100, exerciseId: 10, sets: []}],
    };

    const result = fullStateReducer(stateWithOwnReference, {type: 'IMPORT_TRAININGS_PLAN', payload});

    expect(result.exercises.allIds).toEqual([2]);
    expect(result.exercises.byId[2].vlReference).toEqual(ownReference);
  });
});
