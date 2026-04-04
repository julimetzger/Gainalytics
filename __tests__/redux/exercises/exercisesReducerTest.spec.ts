import exercisesReducer from '../../../app/redux/Exercises/exercisesReducer';
import {NormalizedState} from '../../../app/redux/normalizedState';
import {Exercise} from '../../../app/models/entities/Exercise';

const BASE_STATE = {
  byId: {
    1: {id: 1, name: 'Bench Press', muscles: []},
    2: {id: 2, name: 'Incline Bench', muscles: []},
    3: {id: 3, name: 'Dumbbell Bench', muscles: []},
  },
  allIds: [1, 2, 3],
} satisfies NormalizedState<Exercise>;

describe('exercisesReducer', () => {
  it('adds bidirectional alternatives when editing an exercise', () => {
    expect(
      exercisesReducer(BASE_STATE, {
        type: 'EDIT_EXERCISE',
        exerciseId: 1,
        nameOfExercise: 'Bench Press',
        muscles: [],
        alternativeIds: [2, 3, 2, 99, 1],
      }),
    ).toEqual({
      byId: {
        1: {id: 1, name: 'Bench Press', muscles: [], alternativeIds: [2, 3]},
        2: {id: 2, name: 'Incline Bench', muscles: [], alternativeIds: [1]},
        3: {id: 3, name: 'Dumbbell Bench', muscles: [], alternativeIds: [1]},
      },
      allIds: [1, 2, 3],
    } satisfies NormalizedState<Exercise>);
  });

  it('removes stale bidirectional alternatives when editing an exercise', () => {
    expect(
      exercisesReducer(
        {
          byId: {
            1: {id: 1, name: 'Bench Press', muscles: [], alternativeIds: [2]},
            2: {id: 2, name: 'Incline Bench', muscles: [], alternativeIds: [1]},
            3: {id: 3, name: 'Dumbbell Bench', muscles: []},
          },
          allIds: [1, 2, 3],
        } satisfies NormalizedState<Exercise>,
        {
          type: 'EDIT_EXERCISE',
          exerciseId: 1,
          nameOfExercise: 'Bench Press',
          muscles: [],
          alternativeIds: [3],
        },
      ),
    ).toEqual({
      byId: {
        1: {id: 1, name: 'Bench Press', muscles: [], alternativeIds: [3]},
        2: {id: 2, name: 'Incline Bench', muscles: []},
        3: {id: 3, name: 'Dumbbell Bench', muscles: [], alternativeIds: [1]},
      },
      allIds: [1, 2, 3],
    } satisfies NormalizedState<Exercise>);
  });

  it('removes reverse alternative links when deleting an exercise', () => {
    expect(
      exercisesReducer(
        {
          byId: {
            1: {id: 1, name: 'Bench Press', muscles: [], alternativeIds: [2, 3]},
            2: {id: 2, name: 'Incline Bench', muscles: [], alternativeIds: [1]},
            3: {id: 3, name: 'Dumbbell Bench', muscles: [], alternativeIds: [1]},
          },
          allIds: [1, 2, 3],
        } satisfies NormalizedState<Exercise>,
        {
          type: 'DELETE_EXERCISE',
          exerciseId: 1,
        },
      ),
    ).toEqual({
      byId: {
        2: {id: 2, name: 'Incline Bench', muscles: []},
        3: {id: 3, name: 'Dumbbell Bench', muscles: []},
      },
      allIds: [2, 3],
    } satisfies NormalizedState<Exercise>);
  });
});
