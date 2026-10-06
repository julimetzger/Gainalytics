import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {canClearPlannedTraining, lastPlannedTrainingId} from '../../../app/utils/last-planned-training';

// GH-442: "Clear planned training" empties the plan's most recently planned,
// not-yet-started training — and nothing else in the store.

const workout = (id: number, exerciseId: number) => ({id, exerciseId, sets: [{reps: 5, weight: 100, rir: 2}]});

function buildState(): GlobalState {
  const state = rootReducer(undefined as any, {type: '@@INIT'}) as GlobalState;
  return {
    ...state,
    trainingsPlan: {
      byId: {
        1: {
          id: 1,
          name: 'Push pull',
          trainings: {'1,0': 10, '1,1': 11, '2,0': 12},
          trainingNames: {0: 'Push', 1: 'Pull'},
          lastTraining: 10,
          mesos: [{id: 1, name: 'Meso 1', order: 0, startMicro: 1}],
        },
      },
      allIds: [1],
    },
    trainings: {
      byId: {
        // finished history
        10: {id: 10, state: TrainingsState.FINISHED, exercises: [1], plannedWorkouts: {1: 100}, doneWorkoutIds: {1: 101}},
        // an older planned training
        11: {id: 11, state: TrainingsState.PLANNED, exercises: [2], plannedWorkouts: {2: 110}, doneWorkoutIds: {}},
        // the most recently planned training
        12: {id: 12, state: TrainingsState.PLANNED, exercises: [1, 2], plannedWorkouts: {1: 120, 2: 121}, doneWorkoutIds: {}},
      },
      allIds: [10, 11, 12],
    },
    workouts: {
      ...state.workouts,
      byId: {100: workout(100, 1), 101: workout(101, 1), 110: workout(110, 2), 120: workout(120, 1), 121: workout(121, 2)},
      allIds: [100, 101, 110, 120, 121],
      byExerciseId: {1: [100, 101, 120], 2: [110, 121]},
    } as any,
  };
}

const clear = (state: GlobalState, trainingsId: number) =>
  rootReducer(state, {
    type: 'CLEAR_PLANNED_TRAINING',
    trainingsId,
    workoutIds: Object.values(state.trainings.byId[trainingsId].plannedWorkouts),
  } as any) as GlobalState;

describe('canClearPlannedTraining (GH-442)', () => {
  it('picks the plan training created last as the most recently planned one', () => {
    expect(lastPlannedTrainingId(buildState().trainingsPlan.byId[1])).toBe(12);
    expect(lastPlannedTrainingId({id: 2, name: 'empty', trainings: {}, trainingNames: {}})).toBeUndefined();
  });

  it('is offered for the most recently planned training while it is PLANNED', () => {
    const state = buildState();
    expect(canClearPlannedTraining(state.trainingsPlan.byId[1], state.trainings.byId[12])).toBe(true);
  });

  it('is not offered for an older planned training', () => {
    const state = buildState();
    expect(canClearPlannedTraining(state.trainingsPlan.byId[1], state.trainings.byId[11])).toBe(false);
  });

  it('is not offered once the latest training is started or finished', () => {
    const state = buildState();
    const latest = state.trainings.byId[12];
    expect(canClearPlannedTraining(state.trainingsPlan.byId[1], {...latest, state: TrainingsState.STARTED})).toBe(false);
    expect(canClearPlannedTraining(state.trainingsPlan.byId[1], {...latest, state: TrainingsState.FINISHED})).toBe(false);
  });

  it('is not offered when there is nothing planned to clear, or no training at all', () => {
    const state = buildState();
    expect(canClearPlannedTraining(state.trainingsPlan.byId[1], {...state.trainings.byId[12], exercises: [], plannedWorkouts: {}})).toBe(false);
    expect(canClearPlannedTraining(state.trainingsPlan.byId[1], undefined)).toBe(false);
  });
});

describe('CLEAR_PLANNED_TRAINING (GH-442)', () => {
  it('keeps the training and its slot, but without planned exercises and sets', () => {
    const before = buildState();
    const after = clear(before, 12);

    expect(after.trainings.byId[12]).toEqual({id: 12, state: TrainingsState.PLANNED, exercises: [], plannedWorkouts: {}, doneWorkoutIds: {}});
    expect(after.trainings.allIds).toEqual([10, 11, 12]);
    expect(after.trainingsPlan).toBe(before.trainingsPlan);
    expect(after.trainingsPlan.byId[1].trainings['2,0']).toBe(12);
  });

  it('removes only the cleared training planned workouts', () => {
    const after = clear(buildState(), 12);

    expect(after.workouts.allIds).toEqual([100, 101, 110]);
    expect(after.workouts.byId[120]).toBeUndefined();
    expect(after.workouts.byId[121]).toBeUndefined();
    expect(after.workouts.byExerciseId).toEqual({1: [100, 101], 2: [110]});
  });

  it('leaves other trainings, history and the meso/micro structure untouched', () => {
    const before = buildState();
    const after = clear(before, 12);

    expect(after.trainings.byId[10]).toBe(before.trainings.byId[10]);
    expect(after.trainings.byId[11]).toBe(before.trainings.byId[11]);
    expect(after.workouts.byId[100]).toBe(before.workouts.byId[100]);
    expect(after.workouts.byId[101]).toBe(before.workouts.byId[101]);
    expect(after.workouts.byId[110]).toBe(before.workouts.byId[110]);
    expect(after.trainingsPlan.byId[1].mesos).toBe(before.trainingsPlan.byId[1].mesos);
    expect(after.trainingsPlan.byId[1].lastTraining).toBe(10);
  });

  it('refuses to clear a training that is no longer PLANNED', () => {
    const before = buildState();
    const started = {
      ...before,
      trainings: {...before.trainings, byId: {...before.trainings.byId, 12: {...before.trainings.byId[12], state: TrainingsState.STARTED}}},
    };
    const after = rootReducer(started, {type: 'CLEAR_PLANNED_TRAINING', trainingsId: 12, workoutIds: []} as any) as GlobalState;

    expect(after.trainings).toBe(started.trainings);
  });

  it('a cleared training can be planned again right away', () => {
    const after = clear(buildState(), 12);
    const replanned = rootReducer(after, {
      type: 'MODIFY_EXERCISES_IN_TRAINING',
      exercises: [{id: 3}],
      trainingsPlanId: 1,
      microNumber: 2,
      trainingInMicroNumber: 0,
      nextTrainingsId: 13,
      trainingsId: 12,
    } as any) as GlobalState;

    expect(replanned.trainings.byId[12].exercises).toEqual([3]);
    expect(replanned.trainings.allIds).toEqual([10, 11, 12]);
    expect(replanned.trainingsPlan.byId[1].trainings['2,0']).toBe(12);
  });
});
