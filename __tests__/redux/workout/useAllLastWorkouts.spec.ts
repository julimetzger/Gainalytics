import {AnyAction} from '@reduxjs/toolkit';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {NormalizedWorkoutState} from '../../../app/redux/normalizedWorkoutState';
import {Workout} from '../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../app/models/entities/WorkoutSet';
import {makeSelectAllLastWorkouts} from '../../../app/redux/Workout/use/useAllLastWorkouts';

const TEST_DATE = new Date('2024-05-01T00:00:00.000Z');

const baseGlobalState = {
  exercises: {byId: {}, allIds: []},
  workouts: {byId: {}, allIds: [], byExerciseId: {}, plannedWorkouts: []},
  trainingsPlan: {byId: {}, allIds: []},
  trainings: {byId: {}, allIds: []},
  videoAnalyses: {byId: {}, allIds: []},
  settings: {mode: 'dark'},
  effects: {},
  aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
} satisfies GlobalState;

const buildState = (workouts: NormalizedWorkoutState<Workout>): GlobalState => ({
  ...baseGlobalState,
  workouts,
});

const makeWorkout = (id: number, reps: number, weight: number): Workout => ({
  id,
  exerciseId: 7,
  notes: '',
  start: TEST_DATE,
  end: TEST_DATE,
  sets: [
    {
      index: 1,
      reps,
      rir: 1,
      weight,
      date: TEST_DATE,
    },
  ],
});

describe('makeSelectAllLastWorkouts', () => {
  const firstWorkout = makeWorkout(101, 5, 100);
  const secondWorkout = makeWorkout(102, 4, 105);
  const thirdWorkout = makeWorkout(103, 3, 110);
  const updatedThirdWorkoutSet = {
    index: 1,
    reps: 4,
    rir: 1,
    weight: 112.5,
    date: TEST_DATE,
  } satisfies WorkoutSet;
  const workoutState = {
    byId: {
      101: firstWorkout,
      102: secondWorkout,
      103: thirdWorkout,
    },
    allIds: [101, 102, 103],
    byExerciseId: {
      7: [101, 102, 103],
    },
    plannedWorkouts: [],
  } satisfies NormalizedWorkoutState<Workout>;

  it('returns the requested number of last workouts', () => {
    const selector = makeSelectAllLastWorkouts();
    const state = buildState(workoutState);

    expect(selector(state, 7, 2)).toEqual([secondWorkout, thirdWorkout] satisfies Workout[]);
  });

  it('keeps the same reference when an unrelated redux action changes another slice', () => {
    const selector = makeSelectAllLastWorkouts();
    const state = buildState(workoutState);
    const previous = selector(state, 7, 2);

    const nextState = rootReducer(state, {type: 'TOGGLE_MODE'});
    const next = selector(nextState, 7, 2);

    expect(Object.is(previous, next)).toBe(true);
  });

  it('returns a new reference when a selected workout changes', () => {
    const selector = makeSelectAllLastWorkouts();
    const state = buildState(workoutState);
    const previous = selector(state, 7, 2);

    const updateWorkoutAction: AnyAction = {
      type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
      workoutId: 103,
      set: updatedThirdWorkoutSet,
    };
    const nextState = rootReducer(state, updateWorkoutAction);
    const next = selector(nextState, 7, 2);

    expect(Object.is(previous, next)).toBe(false);
    expect(next).toEqual([
      secondWorkout,
      {
        ...thirdWorkout,
        sets: [updatedThirdWorkoutSet],
      },
    ] satisfies Workout[]);
  });
});
