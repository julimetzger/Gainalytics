import fullStateReducer from '../fullStateReducer';
import {GlobalState} from '../../rootReducer';
import {TrainingsPlanExportPayload} from '../../../utils/exportTrainingsPlan';
import {TrainingsState} from '../../../models/TrainingsState';

describe('fullStateReducer - IMPORT_TRAININGS_PLAN', () => {
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
    const initialState = {
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
      videoAnalyses: {
        byId: {},
        allIds: [],
      },
      settings: {mode: 'dark'},
      effects: {},
    } satisfies GlobalState;

    const action = {
      type: 'IMPORT_TRAININGS_PLAN',
      payload: importPayload,
    };

    const newState = fullStateReducer(initialState, action);

    const expectedState = {
      exercises: {
        byId: {
          1: {id: 1, name: 'Squat'},
          2: {id: 2, name: 'Bench Press', records: {}},
        },
        allIds: [1, 2],
      },
      workouts: {
        byId: {
          1: {id: 1, exerciseId: 1, sets: []},
          2: {id: 2, exerciseId: 2, sets: []},
        },
        plannedWorkouts: [],
        byExerciseId: {
          1: [1],
        },
        allIds: [1, 2],
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
          2: {
            id: 2,
            exercises: [2],
            plannedWorkouts: {2: 2},
            doneWorkoutIds: {},
            state: TrainingsState.PLANNED,
          },
        },
        allIds: [1, 2],
      },
      trainingsPlan: {
        byId: {
          1: {id: 1, name: 'Powerlifting', trainings: {0: 1}, trainingNames: {}},
          2: {id: 2, name: 'New Plan', trainings: {0: 2}, trainingNames: {}},
        },
        allIds: [1, 2],
      },
      videoAnalyses: {
        byId: {},
        allIds: [],
      },
      settings: {mode: 'dark'},
      effects: {},
    } satisfies GlobalState;

    expect(newState).toEqual(expectedState);
  });

  it('should generate imported workout IDs after existing workout IDs in byId', () => {
    const initialState = {
      exercises: {
        byId: {},
        allIds: [],
      },
      workouts: {
        byId: {
          5: {id: 5, exerciseId: 99, sets: []},
        },
        plannedWorkouts: [],
        byExerciseId: {},
        allIds: [],
      },
      trainings: {
        byId: {},
        allIds: [],
      },
      trainingsPlan: {
        byId: {},
        allIds: [],
      },
      videoAnalyses: {
        byId: {},
        allIds: [],
      },
      settings: {mode: 'dark'},
      effects: {},
    } satisfies GlobalState;

    const payload: TrainingsPlanExportPayload = {
      exercises: [{id: 11, name: 'Bench Press', records: {}}],
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
        name: 'Imported Plan',
        trainingNames: {},
        trainings: {0: 30},
      },
    };

    const action = {
      type: 'IMPORT_TRAININGS_PLAN',
      payload,
    };

    const newState = fullStateReducer(initialState, action);

    const expectedState = {
      exercises: {
        byId: {
          1: {id: 1, name: 'Bench Press', records: {}},
        },
        allIds: [1],
      },
      workouts: {
        byId: {
          5: {id: 5, exerciseId: 99, sets: []},
          6: {id: 6, exerciseId: 1, sets: []},
        },
        plannedWorkouts: [],
        byExerciseId: {},
        allIds: [6],
      },
      trainings: {
        byId: {
          1: {
            id: 1,
            exercises: [1],
            plannedWorkouts: {1: 6},
            doneWorkoutIds: {},
            state: TrainingsState.PLANNED,
          },
        },
        allIds: [1],
      },
      trainingsPlan: {
        byId: {
          1: {id: 1, name: 'Imported Plan', trainings: {0: 1}, trainingNames: {}},
        },
        allIds: [1],
      },
      videoAnalyses: {
        byId: {},
        allIds: [],
      },
      settings: {mode: 'dark'},
      effects: {},
    } satisfies GlobalState;

    expect(newState).toEqual(expectedState);
  });
});

describe('fullStateReducer - FULL_IMPORT', () => {
  it('should remove dangling workout references from imported trainings', () => {
    const importedState = {
      exercises: {
        byId: {
          20: {id: 20, name: 'Bench Press'},
        },
        allIds: [20],
      },
      workouts: {
        byId: {
          1: {id: 1, exerciseId: 20, sets: []},
        },
        plannedWorkouts: [],
        byExerciseId: {
          20: [1],
        },
        allIds: [1],
      },
      trainings: {
        byId: {
          1: {
            id: 1,
            exercises: [20, 99],
            plannedWorkouts: {20: 1, 99: 999},
            doneWorkoutIds: {20: 1, 10: 999},
            state: TrainingsState.FINISHED,
          },
        },
        allIds: [1],
      },
      trainingsPlan: {
        byId: {
          1: {id: 1, name: 'Imported Plan', trainings: {'1,1': 1}, trainingNames: {1: 'Day 1'}},
        },
        allIds: [1],
      },
      settings: {mode: 'dark'},
      effects: {},
    } satisfies GlobalState;

    const action = {
      type: 'FULL_IMPORT',
      state: importedState,
    };

    const newState = fullStateReducer(importedState, action);

    const expectedState = {
      exercises: {
        byId: {
          20: {id: 20, name: 'Bench Press'},
        },
        allIds: [20],
      },
      workouts: {
        byId: {
          1: {id: 1, exerciseId: 20, sets: []},
        },
        plannedWorkouts: [],
        byExerciseId: {
          20: [1],
        },
        allIds: [1],
      },
      trainings: {
        byId: {
          1: {
            id: 1,
            exercises: [20],
            plannedWorkouts: {20: 1},
            doneWorkoutIds: {20: 1},
            state: TrainingsState.FINISHED,
          },
        },
        allIds: [1],
      },
      trainingsPlan: {
        byId: {
          1: {id: 1, name: 'Imported Plan', trainings: {'1,1': 1}, trainingNames: {1: 'Day 1'}},
        },
        allIds: [1],
      },
      settings: {mode: 'dark'},
      effects: {},
    } satisfies GlobalState;

    expect(newState).toEqual(expectedState);
  });
});
