import trainingsReducer from '../../../app/redux/Training/trainingsReducer';
import {NormalizedState} from '../../../app/redux/normalizedState';
import {Training} from '../../../app/models/entities/Training';
import {TrainingsState} from '../../../app/models/TrainingsState';

function STATE_WITH_ONE_TRAINING() {
  return {
    byId: {
      3: {
        id: 3,
        exercises: [2],
        plannedWorkouts: {},
        doneWorkoutIds: {},
        state: TrainingsState.PLANNED,
      },
    },
    allIds: [3],
  } satisfies NormalizedState<Training>;
}

describe('trainingsReducer', () => {
  describe('ADD_PLANED_TRAINING_WORKOUT', () => {
    it('it should add and create training if not present', () => {
      expect(
        trainingsReducer(
          {
            byId: {},
            allIds: [],
          },
          {
            type: 'ADD_PLANED_TRAINING_WORKOUT',
            trainingsPlanId: 1,
            microNumber: 1,
            trainingInMicroNumber: 1,
            exerciseId: 2,
            workout: {
              name: 'workout',
            },
            nextTrainingsId: 3,
            nextWorkoutId: 4,
          },
        ),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2],
            doneWorkoutIds: {},
            state: 'P',
            plannedWorkouts: {
              2: 4,
            },
          },
        },
        allIds: [3],
      });
    });

    it('it should add workout to existing training', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'ADD_PLANED_TRAINING_WORKOUT',
          trainingsPlanId: 1,
          microNumber: 1,
          trainingInMicroNumber: 1,
          exerciseId: 2,
          workout: {
            name: 'workout',
          },
          nextTrainingsId: 5,
          nextWorkoutId: 4,
          trainingsId: 3,
        }),
      ).toEqual({
        ...STATE_WITH_ONE_TRAINING(),
        byId: {
          3: {
            ...STATE_WITH_ONE_TRAINING().byId[3],
            plannedWorkouts: {
              2: 4,
            },
          },
        },
      });
    });
  });
  describe('MODIFY_EXERCISES_IN_TRAINING', () => {
    it('it should modify exercises in training', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'MODIFY_EXERCISES_IN_TRAINING',
          exercises: [{id: 2}, {id: 3}],
          trainingsPlanId: 1,
          microNumber: 1,
          trainingInMicroNumber: 1,
          nextTrainingsId: 5,
          trainingsId: 3,
        }),
      ).toEqual({
        ...STATE_WITH_ONE_TRAINING(),
        byId: {
          3: {
            ...STATE_WITH_ONE_TRAINING().byId[3],
            exercises: [2, 3],
          },
        },
      });
    });
    it('it should modify exercises and create Training if not present', () => {
      expect(
        trainingsReducer(
          {
            byId: {},
            allIds: [],
          },
          {
            type: 'MODIFY_EXERCISES_IN_TRAINING',
            exercises: [{id: 2}, {id: 3}],
            trainingsPlanId: 1,
            microNumber: 1,
            trainingInMicroNumber: 1,
            nextTrainingsId: 5,
          },
        ),
      ).toEqual({
        byId: {
          5: {
            id: 5,
            exercises: [2, 3],
            plannedWorkouts: {},
            doneWorkoutIds: {},
            state: 'P',
          },
        },
        allIds: [5],
      });
    });
  });
  describe('ADD_WORKOUT', () => {
    it('it should add workout to existing training', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'ADD_WORKOUT',
          workout: {
            name: 'workout',
            exerciseId: 2,
          },
          nextWorkoutId: 4,
          trainingsId: 3,
        }),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2],
            doneWorkoutIds: {
              2: 4,
            },
            plannedWorkouts: {},
            state: 'P',
          },
        },
        allIds: [3],
      });
    });
    it('it should not add workout to existing training if trainingsId is undefined', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'ADD_WORKOUT',
          workout: {
            name: 'workout',
            exerciseId: 2,
          },
          nextWorkoutId: 4,
        }),
      ).toEqual(STATE_WITH_ONE_TRAINING());
    });
  });
  describe('DELETE_WORKOUT', () => {
    it('it should skip if not connected to training', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'DELETE_WORKOUT',
          workout: {
            id: 1,
            exerciseId: 2,
          },
        }),
      ).toEqual(STATE_WITH_ONE_TRAINING());
    });
    it('it should delete workout from training', () => {
      expect(
        trainingsReducer(
          {
            byId: {
              3: {
                id: 3,
                exercises: [2],
                plannedWorkouts: {},
                doneWorkoutIds: {2: 1},
                state: TrainingsState.PLANNED,
              },
            },
            allIds: [3],
          },
          {
            type: 'DELETE_WORKOUT',
            workout: {
              id: 1,
              exerciseId: 2,
              trainingsId: 3,
            },
          },
        ),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2],
            plannedWorkouts: {},
            doneWorkoutIds: {},
            state: 'P',
          },
        },
        allIds: [3],
      });
    });

    it('it should delete workout mapping by workout id even if trainingsId is wrong', () => {
      expect(
        trainingsReducer(
          {
            byId: {
              3: {
                id: 3,
                exercises: [2, 4],
                plannedWorkouts: {4: 99},
                doneWorkoutIds: {2: 1},
                state: TrainingsState.PLANNED,
              },
            },
            allIds: [3],
          },
          {
            type: 'DELETE_WORKOUT',
            workout: {
              id: 1,
              exerciseId: 2,
              trainingsId: 999,
            },
          },
        ),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2, 4],
            plannedWorkouts: {4: 99},
            doneWorkoutIds: {},
            state: TrainingsState.PLANNED,
          },
        },
        allIds: [3],
      });
    });
  });
  describe('FINISH_TRAINING', () => {
    it('it should finish training', () => {
      let date = new Date();
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'FINISH_TRAINING',
          trainingsId: 3,
          date: date,
        }),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2],
            plannedWorkouts: {},
            doneWorkoutIds: {},
            state: 'F',
            end: date,
          },
        },
        allIds: [3],
      });
    });
  });
  describe('START_TRAINING', () => {
    it('it should start training', () => {
      let date = new Date();
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'START_TRAINING',
          trainingsId: 3,
          date: date,
        }),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2],
            plannedWorkouts: {},
            doneWorkoutIds: {},
            state: 'S',
            start: date,
          },
        },
        allIds: [3],
      });
    });
    it('it should ignore if training is in started state', () => {
      let date = new Date();
      expect(
        trainingsReducer(
          {
            byId: {
              3: {
                id: 3,
                exercises: [2],
                plannedWorkouts: {},
                doneWorkoutIds: {},
                state: TrainingsState.STARTED,
              },
            },
            allIds: [3],
          },
          {
            type: 'START_TRAINING',
            trainingsId: 3,
            date: date,
          },
        ),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2],
            plannedWorkouts: {},
            doneWorkoutIds: {},
            state: 'S',
          },
        },
        allIds: [3],
      });
    });
  });
  describe('default', () => {
    it('it should return state', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'default',
        }),
      ).toEqual(STATE_WITH_ONE_TRAINING());
    });
  });
  describe('SUGGEST_TRAINING', () => {
    it('it should suggest training', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'SUGGEST_TRAINING',
          trainingsId: 3,
          lastTrainingInMicro: {
            exercises: [2],
          },
          workoutIdWorkoutMap: new Map([[2, {exerciseId: 2}]]),
        }),
      ).toEqual({
        byId: {
          3: {
            id: 3,
            exercises: [2],
            plannedWorkouts: {
              2: 2,
            },
            doneWorkoutIds: {},
            state: 'P',
          },
        },
        allIds: [3],
      });
    });
  });
  describe('DELETE_TRAINING', () => {
    it('it should delete training by id', () => {
      expect(
        trainingsReducer(STATE_WITH_ONE_TRAINING(), {
          type: 'DELETE_TRAINING',
          trainingsId: 3,
        }),
      ).toEqual({
        byId: {},
        allIds: [],
      });
    });
  });
});
