import {
  getAllTrainingsForMicro,
  getPreviousTrainingsForTrainingInMeso,
} from '../../../app/redux/Training/trainingsPlanReducer';
import trainingsPlanReducer from '../../../app/redux/Training/trainingsPlanReducer';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';

const DEFAULT_MESO = {id: 1, name: 'Meso 1', order: 1, startMicro: 1};

function ONE_TRAININGS_PLAN() {
  return {
    byId: {
      1: {
        id: 1,
        name: 'plan',
        trainings: {},
        trainingNames: {['1']: 'Push'},
        mesos: [DEFAULT_MESO],
      } satisfies TrainingsPlan,
    },
    allIds: [1],
  };
}

function ONE_TRAININGS_PLAN_WITH_TRAINING() {
  return {
    byId: {
      1: {
        id: 1,
        name: 'plan',
        trainings: {'2,1': 4},
        trainingNames: {['1']: 'Push'},
        mesos: [DEFAULT_MESO],
      } satisfies TrainingsPlan,
    },
    allIds: [1],
  };
}

describe('trainingsPlanReducer', () => {
  describe('helper functions', () => {
    it('should only return trainings for the exact global micro', () => {
      expect(
        getAllTrainingsForMicro(
          {
            '1,1': 10,
            '1,2': 11,
            '10,1': 20,
          },
          1,
        ),
      ).toEqual([10, 11]);
    });

    it('should only return previous trainings from the same meso', () => {
      expect(
        getPreviousTrainingsForTrainingInMeso(
          {
            '1,1': 10,
            '2,1': 11,
            '3,1': 12,
            '4,1': 13,
          },
          1,
          4,
          [
            {id: 1, name: 'Meso 1', order: 1, startMicro: 1},
            {id: 2, name: 'Meso 2', order: 2, startMicro: 3},
          ],
        ),
      ).toEqual([12]);
    });
  });

  describe('ADD_TRAININGS_PLAN', () => {
    it('it should add first trainings plan', () => {
      expect(
        trainingsPlanReducer(
          {
            byId: {},
            allIds: [],
          },
          {
            type: 'ADD_TRAININGS_PLAN',
            trainingsPlan: {
              name: 'plan',
              trainingNames: {['1']: 'Push'},
            },
          },
        ),
      ).toEqual(ONE_TRAININGS_PLAN());
    });
    it('it should add further trainings plan', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'ADD_TRAININGS_PLAN',
          trainingsPlan: {
            name: 'plan',
            trainingNames: {['1']: 'Push'},
          },
        }),
      ).toEqual({
        byId: {
          1: {
            id: 1,
            name: 'plan',
            trainings: {},
            trainingNames: {['1']: 'Push'},
            mesos: [DEFAULT_MESO],
          },
          2: {
            id: 2,
            name: 'plan',
            trainings: {},
            trainingNames: {['1']: 'Push'},
            mesos: [DEFAULT_MESO],
          },
        },
        allIds: [1, 2],
      });
    });
  });
  describe('EDIT_TRAININGS_PLAN', () => {
    it('should edit trainings plan', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'EDIT_TRAININGS_PLAN',
          trainingsPlanId: 1,
          name: 'new name',
        }),
      ).toEqual({
        byId: {
          1: {
            id: 1,
            name: 'new name',
            trainings: {},
            trainingNames: {['1']: 'Push'},
            mesos: [DEFAULT_MESO],
          },
        },
        allIds: [1],
      });
    });
  });
  describe('DELETE_TRAININGS_PLAN', () => {
    it('should delete trainings plan', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'DELETE_TRAININGS_PLAN',
          trainingsPlanId: 1,
        }),
      ).toEqual({
        byId: {},
        allIds: [],
      });
    });
  });
  describe('DELETE_TRAINING', () => {
    it('should delete training slot mapping', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN_WITH_TRAINING(), {
          type: 'DELETE_TRAINING',
          trainingsPlanId: 1,
          micro: 2,
          trainingInMicro: 1,
        }),
      ).toEqual({
        byId: {
          1: {
            id: 1,
            name: 'plan',
            trainings: {},
            trainingNames: {['1']: 'Push'},
            mesos: [DEFAULT_MESO],
          },
        },
        allIds: [1],
      });
    });
  });
  describe('ADD_PLANED_TRAINING_WORKOUT', () => {
    it('should ignore if training exists', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'ADD_PLANED_TRAINING_WORKOUT',
          trainingsPlanId: 1,
          microNumber: 1,
          trainingInMicroNumber: 1,
          trainingsId: 1,
          nextTrainingsId: 2,
        }),
      ).toEqual(ONE_TRAININGS_PLAN());
    });
    it('should add planned training workout', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'ADD_PLANED_TRAINING_WORKOUT',
          trainingsPlanId: 1,
          microNumber: 1,
          trainingInMicroNumber: 1,
          nextTrainingsId: 2,
        }),
      ).toEqual({
        byId: {
          1: {
            id: 1,
            name: 'plan',
            trainings: {
              '1,1': 2,
            },
            trainingNames: {['1']: 'Push'},
            mesos: [DEFAULT_MESO],
          },
        },
        allIds: [1],
      });
    });
  });
  describe('MODIFY_EXERCISES_IN_TRAINING', () => {
    it('should ignore if training exists', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'MODIFY_EXERCISES_IN_TRAINING',
          trainingsPlanId: 1,
          microNumber: 1,
          trainingInMicroNumber: 1,
          trainingsId: 1,
          nextTrainingsId: 2,
        }),
      ).toEqual(ONE_TRAININGS_PLAN());
    });
    it('should add planned training workout', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'MODIFY_EXERCISES_IN_TRAINING',
          trainingsPlanId: 1,
          microNumber: 1,
          trainingInMicroNumber: 1,
          nextTrainingsId: 2,
        }),
      ).toEqual({
        byId: {
          1: {
            id: 1,
            name: 'plan',
            trainings: {
              '1,1': 2,
            },
            trainingNames: {['1']: 'Push'},
            mesos: [DEFAULT_MESO],
          },
        },
        allIds: [1],
      });
    });
  });
  describe('SUGGEST_TRAINING', () => {
    it('should add planned training workout (trainingsId is not set for this action)', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'MODIFY_EXERCISES_IN_TRAINING',
          trainingsPlanId: 1,
          microNumber: 1,
          trainingInMicroNumber: 1,
          nextTrainingsId: 2,
        }),
      ).toEqual({
        byId: {
          1: {
            id: 1,
            name: 'plan',
            trainings: {
              '1,1': 2,
            },
            trainingNames: {['1']: 'Push'},
            mesos: [DEFAULT_MESO],
          },
        },
        allIds: [1],
      });
    });
  });
  describe('CHANGE_TRAININGS_NAME', () => {
    it('should change trainings name', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'CHANGE_TRAININGS_NAME',
          trainingsPlanId: 1,
          trainingsName: 'new name',
          trainingsNumber: 1,
        }),
      ).toEqual({
        byId: {
          1: {
            id: 1,
            name: 'plan',
            trainings: {},
            trainingNames: {
              1: 'new name',
            },
            mesos: [DEFAULT_MESO],
          },
        },
        allIds: [1],
      });
    });
  });
  describe('Default', () => {
    it('should not modify for unknown action type', () => {
      expect(
        trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
          type: 'UNKNOWN',
        }),
      ).toEqual(ONE_TRAININGS_PLAN());
    });
  });

  describe('ADD_MESO', () => {
    it('should add a meso to a plan without mesos', () => {
      const emptyMesosPlan = {
        byId: {1: {...ONE_TRAININGS_PLAN().byId[1], mesos: [] as any}},
        allIds: [1],
      };
      const meso = {id: 2, name: 'Meso 2', order: 2, startMicro: 5};
      const result = trainingsPlanReducer(emptyMesosPlan, {
        type: 'ADD_MESO',
        trainingsPlanId: 1,
        meso,
      });
      expect(result.byId[1].mesos).toEqual([DEFAULT_MESO, meso]);
    });

    it('should append a meso when one already exists', () => {
      const existingMeso = {id: 1, name: 'Meso 1', order: 1, startMicro: 1};
      const newMeso = {id: 2, name: 'Meso 2', order: 2, startMicro: 5};
      const stateWithMeso = {
        ...ONE_TRAININGS_PLAN(),
        byId: {1: {...ONE_TRAININGS_PLAN().byId[1], mesos: [existingMeso]}},
      };
      const result = trainingsPlanReducer(stateWithMeso, {
        type: 'ADD_MESO',
        trainingsPlanId: 1,
        meso: newMeso,
      });
      expect(result.byId[1].mesos).toEqual([existingMeso, newMeso]);
    });
  });

  describe('EDIT_MESO', () => {
    it('should rename a meso', () => {
      const meso = {id: 1, name: 'Meso 1', order: 1, startMicro: 1};
      const stateWithMeso = {
        ...ONE_TRAININGS_PLAN(),
        byId: {1: {...ONE_TRAININGS_PLAN().byId[1], mesos: [meso]}},
      };
      const result = trainingsPlanReducer(stateWithMeso, {
        type: 'EDIT_MESO',
        trainingsPlanId: 1,
        mesoId: 1,
        name: 'Hypertrophy Block',
      });
      expect(result.byId[1].mesos![0].name).toBe('Hypertrophy Block');
    });
  });

  describe('DELETE_MESO', () => {
    it('should move a deleted first meso into the next meso', () => {
      const meso1 = {id: 1, name: 'Meso 1', order: 1, startMicro: 1};
      const meso2 = {id: 2, name: 'Meso 2', order: 2, startMicro: 5};
      const stateWithMesos = {
        ...ONE_TRAININGS_PLAN(),
        byId: {1: {...ONE_TRAININGS_PLAN().byId[1], mesos: [meso1, meso2]}},
      };
      const result = trainingsPlanReducer(stateWithMesos, {
        type: 'DELETE_MESO',
        trainingsPlanId: 1,
        mesoId: 1,
      });
      expect(result.byId[1].mesos).toEqual([{...meso2, startMicro: 1}]);
    });

    it('should keep the final meso instead of deleting all meso ownership', () => {
      const result = trainingsPlanReducer(ONE_TRAININGS_PLAN(), {
        type: 'DELETE_MESO',
        trainingsPlanId: 1,
        mesoId: 1,
      });
      expect(result).toEqual(ONE_TRAININGS_PLAN());
    });
  });
});
