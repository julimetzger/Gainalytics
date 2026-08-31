import exercisesReducer from '../../../app/redux/Exercises/exercisesReducer';
import {NormalizedState} from '../../../app/redux/normalizedState';
import {Exercise, VelocityLossReference} from '../../../app/models/entities/Exercise';

const SQUAT_REFERENCE: VelocityLossReference = {
  rir: 1,
  velocityLossPercent: 14.29,
  referencedAt: '2026-03-15T10:00:00.000Z',
  analysisId: 7,
  workoutId: 42,
  setIndex: 2,
};

const BASE_STATE = {
  byId: {
    1: {id: 1, name: 'Bench Press', muscles: []},
    2: {id: 2, name: 'Squat', muscles: []},
  },
  allIds: [1, 2],
} satisfies NormalizedState<Exercise>;

describe('exercisesReducer – VL reference (GH-316)', () => {
  it('stores the reference on the targeted exercise and leaves the others untouched', () => {
    expect(
      exercisesReducer(BASE_STATE, {
        type: 'SET_EXERCISE_VL_REFERENCE',
        exerciseId: 2,
        vlReference: SQUAT_REFERENCE,
      }),
    ).toEqual({
      byId: {
        1: {id: 1, name: 'Bench Press', muscles: []},
        2: {id: 2, name: 'Squat', muscles: [], vlReference: SQUAT_REFERENCE},
      },
      allIds: [1, 2],
    } satisfies NormalizedState<Exercise>);
  });

  it('replaces an existing reference instead of keeping a second one', () => {
    const replacement: VelocityLossReference = {
      rir: 3,
      velocityLossPercent: 22,
      referencedAt: '2026-04-01T08:30:00.000Z',
      analysisId: 9,
    };

    expect(
      exercisesReducer(
        {
          byId: {
            1: {id: 1, name: 'Bench Press', muscles: []},
            2: {id: 2, name: 'Squat', muscles: [], vlReference: SQUAT_REFERENCE},
          },
          allIds: [1, 2],
        },
        {type: 'SET_EXERCISE_VL_REFERENCE', exerciseId: 2, vlReference: replacement},
      ),
    ).toEqual({
      byId: {
        1: {id: 1, name: 'Bench Press', muscles: []},
        2: {id: 2, name: 'Squat', muscles: [], vlReference: replacement},
      },
      allIds: [1, 2],
    } satisfies NormalizedState<Exercise>);
  });

  it('drops the reference entirely on clear, restoring the global-curve state', () => {
    expect(
      exercisesReducer(
        {
          byId: {
            1: {id: 1, name: 'Bench Press', muscles: []},
            2: {id: 2, name: 'Squat', muscles: [], vlReference: SQUAT_REFERENCE},
          },
          allIds: [1, 2],
        },
        {type: 'CLEAR_EXERCISE_VL_REFERENCE', exerciseId: 2},
      ),
    ).toEqual(BASE_STATE);
  });

  it('ignores both actions for an unknown exercise', () => {
    expect(exercisesReducer(BASE_STATE, {type: 'SET_EXERCISE_VL_REFERENCE', exerciseId: 99, vlReference: SQUAT_REFERENCE})).toBe(BASE_STATE);
    expect(exercisesReducer(BASE_STATE, {type: 'CLEAR_EXERCISE_VL_REFERENCE', exerciseId: 99})).toBe(BASE_STATE);
  });

  it('is a no-op when clearing an exercise that has no reference', () => {
    expect(exercisesReducer(BASE_STATE, {type: 'CLEAR_EXERCISE_VL_REFERENCE', exerciseId: 2})).toBe(BASE_STATE);
  });

  it('keeps the reference when the exercise is edited', () => {
    expect(
      exercisesReducer(
        {
          byId: {
            1: {id: 1, name: 'Bench Press', muscles: []},
            2: {id: 2, name: 'Squat', muscles: [], vlReference: SQUAT_REFERENCE},
          },
          allIds: [1, 2],
        },
        {type: 'EDIT_EXERCISE', exerciseId: 2, nameOfExercise: 'Back Squat', muscles: [], alternativeIds: []},
      ),
    ).toEqual({
      byId: {
        1: {id: 1, name: 'Bench Press', muscles: [], alternativeIds: undefined},
        2: {id: 2, name: 'Back Squat', isFocus: false, muscles: [], alternativeIds: undefined, vlReference: SQUAT_REFERENCE},
      },
      allIds: [1, 2],
    } satisfies NormalizedState<Exercise>);
  });
});
