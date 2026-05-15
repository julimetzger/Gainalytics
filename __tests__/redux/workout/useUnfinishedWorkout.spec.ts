import {AnyAction} from '@reduxjs/toolkit';
import rootReducer, {GlobalState} from '../../../app/redux/rootReducer';
import {NormalizedWorkoutState} from '../../../app/redux/normalizedWorkoutState';
import {Workout} from '../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../app/models/entities/WorkoutSet';
import {makeSelectUnfinishedWorkout} from '../../../app/redux/Workout/use/useUnfinishedWorkout';

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

const makeSet = (index: number, reps: number, weight: number): WorkoutSet => ({
  index,
  reps,
  rir: 1,
  weight,
  date: TEST_DATE,
});

describe('makeSelectUnfinishedWorkout', () => {
  const persistedSet = makeSet(1, 5, 100);
  const updatedPersistedSet = makeSet(1, 6, 105);
  const suggestedSet = {
    index: 2,
    reps: 5,
    rir: 1,
    weight: 102.5,
  } satisfies WorkoutSet;
  const unfinishedWorkout = {
    id: 101,
    exerciseId: 7,
    notes: '',
    start: TEST_DATE,
    sets: [persistedSet],
  } satisfies Workout;
  const suggestedWorkout = {
    exerciseId: 7,
    notes: '',
    sets: [suggestedSet],
  } satisfies Workout;
  const workoutState = {
    byId: {
      101: unfinishedWorkout,
    },
    allIds: [101],
    byExerciseId: {
      7: [101],
    },
    notFinishedWorkouts: {
      7: 101,
    },
    suggestedWorkouts: {
      7: suggestedWorkout,
    },
    plannedWorkouts: [],
  } satisfies NormalizedWorkoutState<Workout>;

  it('returns the combined unfinished and suggested workout with sorted sets', () => {
    const selector = makeSelectUnfinishedWorkout();
    const state = buildState(workoutState);

    expect(selector(state, 7)).toEqual({
      id: 101,
      exerciseId: 7,
      notes: '',
      start: TEST_DATE,
      sets: [persistedSet, suggestedSet],
    } satisfies Workout);
  });

  it('keeps the same reference when an unrelated redux action changes another slice', () => {
    const selector = makeSelectUnfinishedWorkout();
    const state = buildState(workoutState);
    const previous = selector(state, 7);

    const nextState = rootReducer(state, {type: 'TOGGLE_MODE'});
    const next = selector(nextState, 7);

    expect(Object.is(previous, next)).toBe(true);
  });

  it('returns a new reference when the unfinished workout changes', () => {
    const selector = makeSelectUnfinishedWorkout();
    const state = buildState(workoutState);
    const previous = selector(state, 7);

    const updateWorkoutAction: AnyAction = {
      type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
      workoutId: 101,
      set: updatedPersistedSet,
    };
    const nextState = rootReducer(state, updateWorkoutAction);
    const next = selector(nextState, 7);

    expect(Object.is(previous, next)).toBe(false);
    expect(next).toEqual({
      id: 101,
      exerciseId: 7,
      notes: '',
      start: TEST_DATE,
      sets: [updatedPersistedSet, suggestedSet],
    } satisfies Workout);
  });
});
