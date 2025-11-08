import exerciseReducer from '../../../app/redux/exercises/exercisesReducer';
import {Workout} from '../../../app/models/Workout';
import {NormalizedState} from '../../../app/redux/normalizedState';
import {Exercise} from '../../../app/models/Exercise';

describe('exerciseReducer', () => {
  it('should add an exercise', () => {
    const initialState = {
      byId: {
        1: {
          id: 1,
          name: 'Bankdrücken',
        },
        2: {
          id: 2,
          name: 'Squat',
        },
        3: {
          id: 3,
          name: 'Deadlift',
        },
      },
      allIds: [1, 2, 3],
    };
    const action = {
      type: 'ADD_EXERCISE',
      nameOfExercise: 'Overhead Press',
      muscles: [{muscle: 'Bizeps', percent: 50}],
    };
    const expectedState = {
      byId: {
        1: {
          id: 1,
          name: 'Bankdrücken',
        },
        2: {
          id: 2,
          name: 'Squat',
        },
        3: {
          id: 3,
          name: 'Deadlift',
        },
        4: {
          id: 4,
          name: 'Overhead Press',
          muscles: [{muscle: 'Bizeps', percent: 50}],
        },
      },
      allIds: [1, 2, 3, 4],
    };
    expect(exerciseReducer(initialState, action)).toEqual(expectedState);
  });
  it('should delete an exercise', () => {
    const initialState = {
      byId: {
        1: {
          id: 1,
          name: 'Bankdrücken',
        },
        2: {
          id: 2,
          name: 'Squat',
        },
        3: {
          id: 3,
          name: 'Deadlift',
        },
      },
      allIds: [1, 2, 3],
    };
    const action = {
      type: 'DELETE_EXERCISE',
      exerciseId: 2,
    };
    const expectedState = {
      byId: {
        1: {
          id: 1,
          name: 'Bankdrücken',
        },
        3: {
          id: 3,
          name: 'Deadlift',
        },
      },
      allIds: [1, 3],
    };
    expect(exerciseReducer(initialState, action)).toEqual(expectedState);
  });
  it('should edit an exercise', () => {
    const initialState = {
      byId: {
        1: {
          id: 1,
          name: 'Bankdrücken',
        },
        2: {
          id: 2,
          name: 'Squat',
        },
        3: {
          id: 3,
          name: 'Deadlift',
        },
      },
      allIds: [1, 2, 3],
    };
    const action = {
      type: 'EDIT_EXERCISE',
      exerciseId: 2,
      nameOfExercise: 'Front Squat',
      muscles: [{muscle: 'Bizeps', percent: 50}],
    };
    const expectedState = {
      byId: {
        1: {
          id: 1,
          name: 'Bankdrücken',
        },
        2: {
          id: 2,
          name: 'Front Squat',
          muscles: [{muscle: 'Bizeps', percent: 50}],
        },
        3: {
          id: 3,
          name: 'Deadlift',
        },
      },
      allIds: [1, 2, 3],
    };
    expect(exerciseReducer(initialState, action)).toEqual(expectedState);
  });
  describe('default', () => {
    it('should return the initial state', () => {
      const initialState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      const action = {
        type: 'DEFAULT',
      };
      expect(exerciseReducer(initialState, action)).toEqual(initialState);
    });
  });
  describe('record handling', () => {
    it('should add a record', () => {
      const initialState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      const action = {
        type: 'ADD_RECORD',
        exerciseId: 2,
        record: '1RM',
        value: 100.0,
        workoutId: 1,
      };
      const expectedState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
            records: {
              '1RM': [{value: (100).toFixed(2), workoutId: 1}],
            },
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      expect(exerciseReducer(initialState, action)).toEqual(expectedState);
    });
    it('should update a record', () => {
      const initialState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
            records: {
              '1RM': [{value: 100, workoutId: 1}],
            },
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      } satisfies NormalizedState<Exercise>;
      const action = {
        type: 'UPDATE_RECORD',
        exerciseId: 2,
        record: '1RM',
        value: 120.0,
        workoutId: 1,
      };
      const expectedState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
            records: {
              '1RM': [{value: (120).toFixed(2), workoutId: 1}],
            },
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      expect(exerciseReducer(initialState, action)).toEqual(expectedState);
    });
    it('should delete a record', () => {
      const initialState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
            records: {
              '1RM': [{value: 100.0, workoutId: 1}],
            },
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      const action = {
        type: 'DELETE_RECORD',
        exerciseId: 2,
        record: '1RM',
        workoutId: 1,
      };
      const expectedState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
            records: {
              '1RM': [],
            },
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      expect(exerciseReducer(initialState, action)).toEqual(expectedState);
    });
    it('should delete record if workout is deleted', () => {
      const initialState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
            records: {
              '1RM': [{value: 100, workoutId: 1}],
            },
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      const action = {
        type: 'DELETE_WORKOUT',
        workout: {
          id: 1,
          sets: [],
          date: new Date(),
          exerciseId: 2,
          notes: '',
        } as Workout,
      };
      const expectedState = {
        byId: {
          1: {
            id: 1,
            name: 'Bankdrücken',
          },
          2: {
            id: 2,
            name: 'Squat',
            records: {
              '1RM': [],
            },
          },
          3: {
            id: 3,
            name: 'Deadlift',
          },
        },
        allIds: [1, 2, 3],
      };
      expect(exerciseReducer(initialState, action)).toEqual(expectedState);
    });
  });
});
