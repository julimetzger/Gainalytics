import fullStateReducer from '../fullStateReducer';
import {GlobalState} from '../../rootReducer';
import {TrainingsPlanExportPayload} from '../../../utils/exportTrainingsPlan';
import {TrainingsState} from '../../../models/TrainingsState';

describe('fullStateReducer - IMPORT_TRAININGS_PLAN', () => {
  const initialState: GlobalState = {
    exercises: {
      byId: {
        1: {id: 1, name: 'Squat'},
      },
      allIds: [1],
    },
    workouts: {
      byId: {
        1: {id: 1, exerciseId: 1, sets: []},
      },
      plannedWorkouts: [],
      byExerciseId: {
        1: [1],
      },
      allIds: [1],
    },
    trainings: {
      byId: {
        1: {
          id: 1,
          exercises: [1],
          plannedWorkouts: {1: 1},
          doneWorkoutIds: {},
          state: TrainingsState.PLANNED,
        },
      },
      allIds: [1],
    },
    trainingsPlan: {
      byId: {
        1: {id: 1, name: 'Powerlifting', trainings: {0: 1}, trainingNames: {}},
      },
      allIds: [1],
    },
    settings: {} as any,
    effects: {} as any,
  };

  const importPayload: TrainingsPlanExportPayload = {
    exercises: [
      {id: 10, name: 'Squat', records: {}}, // Existing by name
      {id: 11, name: 'Bench Press', records: {}}, // New
    ],
    workouts: [{id: 20, exerciseId: 11, sets: []}],
    trainings: [
      {
        id: 30,
        exercises: [11],
        plannedWorkouts: {11: 20},
        doneWorkoutIds: {},
        state: TrainingsState.PLANNED,
      },
    ],
    trainingsPlan: {
      id: 40,
      name: 'New Plan',
      trainingNames: {},
      trainings: {0: 30},
    },
  };

  it('should import a trainings plan and map IDs correctly', () => {
    const action = {
      type: 'IMPORT_TRAININGS_PLAN',
      payload: importPayload,
    };

    const newState = fullStateReducer(initialState, action as any);

    // 1. Check Exercises
    // Squat already existed (ID 1), Bench Press should be new (ID 2)
    expect(newState.exercises.allIds).toContain(1);
    expect(newState.exercises.allIds).toContain(2);
    expect(newState.exercises.byId[1].name).toBe('Squat');
    expect(newState.exercises.byId[2].name).toBe('Bench Press');

    // 2. Check Workouts
    // New workout should have ID 2
    expect(newState.workouts.allIds).toContain(2);
    expect(newState.workouts.byId[2].exerciseId).toBe(2); // Mapped to new Bench Press ID

    // 3. Check Trainings
    // New training should have ID 2
    expect(newState.trainings.allIds).toContain(2);
    expect(newState.trainings.byId[2].exercises).toEqual([2]);
    expect(newState.trainings.byId[2].plannedWorkouts).toEqual({2: 2});

    // 4. Check TrainingsPlan
    // New plan should have ID 2
    expect(newState.trainingsPlan.allIds).toContain(2);
    expect(newState.trainingsPlan.byId[2].name).toBe('New Plan');
    expect(newState.trainingsPlan.byId[2].trainings).toEqual({0: 2});
  });
});
