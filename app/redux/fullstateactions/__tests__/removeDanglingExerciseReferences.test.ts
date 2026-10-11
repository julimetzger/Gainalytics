import rootReducer, {GlobalState} from '../../rootReducer';
import {TrainingsState} from '../../../models/TrainingsState';
import {selectExerciseUsage} from '../../Exercises/use/useExerciseUsage';
import {removeDanglingExerciseReferences} from '../removeDanglingExerciseReferences';

// GH-486: deleting an exercise that a (running) training uses crashed the app,
// and the training could not be opened afterwards.
const SET = {reps: 5, rir: 2, weight: 100, index: 1};

const buildState = (): GlobalState => {
  const base = rootReducer(undefined as any, {type: '@@INIT'}) as GlobalState;
  return {
    ...base,
    exercises: {
      byId: {
        1: {id: 1, name: 'Squat', muscles: [], alternativeIds: [5]},
        5: {id: 5, name: 'New exercise', muscles: [], alternativeIds: [1]},
      },
      allIds: [1, 5],
    } as any,
    workouts: {
      byId: {
        // finished history of exercise 5
        10: {id: 10, exerciseId: 5, sets: [SET, {...SET, index: 2}], start: new Date(0), end: new Date(1)},
        // running training: logged sets for 1 and 5
        11: {id: 11, exerciseId: 1, sets: [SET], start: new Date(2)},
        12: {id: 12, exerciseId: 5, sets: [SET, {...SET, index: 2}], start: new Date(2)},
        // planned workouts (not part of byExerciseId)
        20: {id: 20, exerciseId: 5, sets: [SET]},
        21: {id: 21, exerciseId: 1, sets: [SET]},
      },
      allIds: [10, 11, 12],
      byExerciseId: {1: [11], 5: [10, 12]},
      notFinishedWorkouts: {1: 11, 5: 12},
      suggestedWorkouts: {},
      plannedWorkouts: [20, 21],
    } as any,
    trainings: {
      byId: {
        100: {id: 100, state: TrainingsState.STARTED, exercises: [1, 5], doneWorkoutIds: {1: 11, 5: 12}, plannedWorkouts: {1: 21, 5: 20}},
        101: {id: 101, state: TrainingsState.PLANNED, exercises: [5, 1], doneWorkoutIds: {}, plannedWorkouts: {5: 20}},
        102: {id: 102, state: TrainingsState.FINISHED, exercises: [5], doneWorkoutIds: {5: 10}, plannedWorkouts: {}},
      },
      allIds: [100, 101, 102],
    } as any,
  };
};

describe('DELETE_EXERCISE (GH-486)', () => {
  it('removes the exercise from every training, including the running one, and keeps the other exercises', () => {
    const next = rootReducer(buildState() as any, {type: 'DELETE_EXERCISE', exerciseId: 5}) as GlobalState;

    expect(next.exercises.byId[5]).toBeUndefined();
    expect(next.trainings.byId[100]).toEqual(
      expect.objectContaining({state: TrainingsState.STARTED, exercises: [1], doneWorkoutIds: {1: 11}, plannedWorkouts: {1: 21}}),
    );
    expect(next.trainings.byId[101]).toEqual(expect.objectContaining({exercises: [1], plannedWorkouts: {}}));
    expect(next.trainings.byId[102]).toEqual(expect.objectContaining({state: TrainingsState.FINISHED, exercises: [], doneWorkoutIds: {}}));
  });

  it('deletes the logged and planned workouts of the exercise and leaves the others alone', () => {
    const next = rootReducer(buildState() as any, {type: 'DELETE_EXERCISE', exerciseId: 5}) as GlobalState;

    expect(Object.keys(next.workouts.byId).map(Number).sort()).toEqual([11, 21]);
    expect(next.workouts.allIds).toEqual([11]);
    expect(next.workouts.plannedWorkouts).toEqual([21]);
    expect(next.workouts.byExerciseId).toEqual({1: [11]});
    expect(next.workouts.notFinishedWorkouts).toEqual({1: 11});
    expect(next.exercises.byId[1].alternativeIds ?? []).toEqual([]);
  });

  it('does not mutate the previous state', () => {
    const state = buildState();
    const snapshot = JSON.stringify(state);
    rootReducer(state as any, {type: 'DELETE_EXERCISE', exerciseId: 5});
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('REPAIR_DANGLING_EXERCISE_REFERENCES (GH-486, stores broken by older versions)', () => {
  // What an older version left behind: exercise and its logged workouts gone, trainings still pointing at it.
  const legacyState = (): GlobalState => {
    const state = buildState();
    const {5: _exercise, ...exercises} = state.exercises.byId as any;
    const {10: _w10, 12: _w12, ...workouts} = state.workouts.byId as any;
    return {
      ...state,
      exercises: {byId: exercises, allIds: [1]},
      workouts: {...state.workouts, byId: workouts, allIds: [11], byExerciseId: {1: [11]}, notFinishedWorkouts: {1: 11}},
    } as GlobalState;
  };

  it('drops the references so the running training opens again, without touching anything else', () => {
    const next = rootReducer(legacyState() as any, {type: 'REPAIR_DANGLING_EXERCISE_REFERENCES'}) as GlobalState;

    expect(next.trainings.byId[100]).toEqual(
      expect.objectContaining({state: TrainingsState.STARTED, exercises: [1], doneWorkoutIds: {1: 11}, plannedWorkouts: {1: 21}}),
    );
    expect(next.trainings.byId[101].exercises).toEqual([1]);
    expect(next.workouts.plannedWorkouts).toEqual([21]);
    expect(next.workouts.byId[20]).toBeUndefined();
    expect(next.workouts.byId[11].sets).toEqual([SET]);
  });

  it('returns the very same state when nothing dangles, so a normal app start changes nothing', () => {
    const state = buildState();
    expect(rootReducer(state as any, {type: 'REPAIR_DANGLING_EXERCISE_REFERENCES'}).trainings).toBe(state.trainings);
    expect(rootReducer(state as any, {type: 'REPAIR_DANGLING_EXERCISE_REFERENCES'}).workouts).toBe(state.workouts);
  });

  it('repairs a legacy store whose only exercise was deleted (empty exercise slice)', () => {
    const state = {...legacyState(), exercises: {byId: {}, allIds: []}} as GlobalState;
    const next = rootReducer(state as any, {type: 'REPAIR_DANGLING_EXERCISE_REFERENCES'}) as GlobalState;
    Object.values(next.trainings.byId).forEach((training) => {
      expect(training.exercises).toEqual([]);
      expect(training.doneWorkoutIds).toEqual({});
      expect(training.plannedWorkouts).toEqual({});
    });
    expect(next.workouts.byId).toEqual({});
    expect(next.workouts.allIds).toEqual([]);
    expect(next.workouts.plannedWorkouts).toEqual([]);
    expect(next.workouts.notFinishedWorkouts).toEqual({});
  });

  it('cleans every reference when the deleted exercise was the last one', () => {
    const base = buildState();
    const state = {
      ...base,
      exercises: {byId: {5: base.exercises.byId[5]}, allIds: [5]},
      workouts: {
        ...base.workouts,
        byId: {10: base.workouts.byId[10], 12: base.workouts.byId[12], 20: base.workouts.byId[20]},
        allIds: [10, 12],
        byExerciseId: {5: [10, 12]},
        notFinishedWorkouts: {5: 12},
        plannedWorkouts: [20],
      },
      trainings: {
        byId: {
          100: {id: 100, state: TrainingsState.STARTED, exercises: [5], doneWorkoutIds: {5: 12}, plannedWorkouts: {5: 20}},
          101: {id: 101, state: TrainingsState.PLANNED, exercises: [5], doneWorkoutIds: {}, plannedWorkouts: {5: 20}},
        },
        allIds: [100, 101],
      },
    } as any as GlobalState;
    const next = rootReducer(state as any, {type: 'DELETE_EXERCISE', exerciseId: 5}) as GlobalState;
    expect(next.exercises.allIds).toEqual([]);
    expect(next.trainings.byId[100]).toEqual(
      expect.objectContaining({state: TrainingsState.STARTED, exercises: [], doneWorkoutIds: {}, plannedWorkouts: {}}),
    );
    expect(next.trainings.byId[101].exercises).toEqual([]);
    expect(next.workouts.byId).toEqual({});
    expect(next.workouts.plannedWorkouts).toEqual([]);
  });

  it('gives the next exercise a valid id once the last one is gone', () => {
    const state = {...buildState(), exercises: {byId: {}, allIds: []}} as any as GlobalState;
    const next = rootReducer(state as any, {type: 'ADD_EXERCISE', nameOfExercise: 'Bench', muscles: []}) as GlobalState;
    expect(next.exercises.allIds).toEqual([1]);
    expect(next.exercises.byId[1]).toEqual(expect.objectContaining({id: 1, name: 'Bench'}));
  });

  it('leaves the store alone when the exercise data is missing entirely (not loaded)', () => {
    const state = {...legacyState(), exercises: undefined} as any as GlobalState;
    expect(removeDanglingExerciseReferences(state)).toBe(state);
    const noById = {...legacyState(), exercises: {allIds: []}} as any as GlobalState;
    expect(removeDanglingExerciseReferences(noById)).toBe(noById);
  });
});

describe('selectExerciseUsage (GH-486)', () => {
  it('reports the running training with its logged sets, planned trainings and the history', () => {
    expect(selectExerciseUsage(buildState(), 5)).toEqual({
      inRunningTraining: true,
      runningTrainingSets: 2,
      plannedTrainings: 1,
      loggedWorkouts: 2,
      loggedSets: 4,
    });
  });

  it('reports a running training without logged sets', () => {
    const state = buildState();
    state.trainings.byId[100] = {...state.trainings.byId[100], doneWorkoutIds: {1: 11}};
    expect(selectExerciseUsage(state, 5)).toEqual(expect.objectContaining({inRunningTraining: true, runningTrainingSets: 0}));
  });

  it('reports nothing for an unused exercise', () => {
    const state = buildState();
    expect(selectExerciseUsage({...state, trainings: {byId: {}, allIds: []}, workouts: {...state.workouts, byExerciseId: {}}} as any, 5)).toEqual({
      inRunningTraining: false,
      runningTrainingSets: 0,
      plannedTrainings: 0,
      loggedWorkouts: 0,
      loggedSets: 0,
    });
  });
});
