import trainingsPlanReducer from '../../../app/redux/Training/trainingsPlanReducer';
import {TrainingsPlan} from '../../../app/models/entities/TrainingsPlan';

function ONE_TRAININGS_PLAN() {
  return {
    byId: {
      1: {
        id: 1,
        name: 'plan',
        trainings: {},
        trainingNames: {['1']: 'Push'},
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
      } satisfies TrainingsPlan,
    },
    allIds: [1],
  };
}

describe('trainingsPlanReducer', () => {
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
          },
          2: {
            id: 2,
            name: 'plan',
            trainings: {},
            trainingNames: {['1']: 'Push'},
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
});
