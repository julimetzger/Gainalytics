import workoutReducer from '../../../app/redux/Workout/workoutReducer';
import {NormalizedWorkoutState} from '../../../app/redux/normalizedWorkoutState';
import {Workout} from '../../../app/models/entities/Workout';

// GH-671: the incremental persistence writes a workout only when `byId[id]` is a different object
// than the one written last. A reducer that changes a stored workout in place (same object, new
// content) would never reach the disk. So: a workout that is still the same object after an action
// must still have the same content.

const start = new Date('2026-11-01T10:00:00.000Z');

const workoutState = (): NormalizedWorkoutState<Workout> => {
  const done = {id: 1, exerciseId: 1, start, end: start, notes: '', sets: [{index: 1, reps: 5, weight: 100, rir: 1, date: start}], records: {'1RM': 112}};
  const running = {id: 2, exerciseId: 1, start, notes: '', sets: [{index: 1, reps: 5, weight: 20, rir: 0, date: start}]};
  return {
    byId: {1: done, 2: running} as any,
    allIds: [1, 2],
    byExerciseId: {1: [1, 2]},
    plannedWorkouts: [],
    notFinishedWorkouts: {1: 2},
    suggestedWorkouts: {},
  } as NormalizedWorkoutState<Workout>;
};

describe('workout reducer never changes a stored workout in place (GH-671)', () => {
  it.each([
    ['ADD_OR_UPDATE_SET_IN_WORKOUT (new set)', {type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId: 2, set: {reps: 5, weight: 20, rir: 0, date: start}}],
    ['ADD_OR_UPDATE_SET_IN_WORKOUT (correction)', {type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId: 2, set: {index: 1, reps: 6, weight: 20, rir: 0, date: start}}],
    ['ADD_OR_UPDATE_SET_IN_WORKOUT (planned index)', {type: 'ADD_OR_UPDATE_SET_IN_WORKOUT', workoutId: 2, set: {index: 3, reps: 6, weight: 20, rir: 0, date: start}}],
    ['DELETE_SET_FROM_WORKOUT', {type: 'DELETE_SET_FROM_WORKOUT', workoutId: 1, exerciseId: 1, set: {index: 1}}],
    ['REPLACE_WORKOUT_SETS', {type: 'REPLACE_WORKOUT_SETS', workoutId: 1, sets: [{index: 1, reps: 3, weight: 90, rir: 2}]}],
    ['FINALIZE_WORKOUT', {type: 'FINALIZE_WORKOUT', workoutId: 2, end: start}],
    ['ADD_RECORD', {type: 'ADD_RECORD', workoutId: 2, record: '1RM', value: 30}],
    ['UPDATE_RECORD', {type: 'UPDATE_RECORD', workoutId: 1, record: '1RM', value: 115}],
    ['DELETE_RECORD', {type: 'DELETE_RECORD', workoutId: 1, record: '1RM'}],
    ['ADD_WORKOUT', {type: 'ADD_WORKOUT', workout: {exerciseId: 3, start, notes: '', sets: [{index: 1, reps: 5, weight: 20, rir: 0, date: start}]}}],
  ])('%s returns a new object for every workout it changes', (_name, action) => {
    const state = workoutState();
    const before = Object.fromEntries(Object.entries(state.byId).map(([id, workout]) => [id, JSON.stringify(workout)]));
    const next = workoutReducer(state, action);
    const changedInPlace = Object.keys(before).filter((id) => next.byId[Number(id)] === state.byId[Number(id)] && JSON.stringify(next.byId[Number(id)]) !== before[id]);
    expect(changedInPlace).toEqual([]);
  });

  it('FINALIZE_WORKOUT stores the end on a new workout object and leaves the old one untouched', () => {
    const state = workoutState();
    const next = workoutReducer(state, {type: 'FINALIZE_WORKOUT', workoutId: 2, end: start});
    expect(next.byId[2]).toEqual({id: 2, exerciseId: 1, start, end: start, notes: '', sets: [{index: 1, reps: 5, weight: 20, rir: 0, date: start}]});
    expect(state.byId[2].end).toBeUndefined();
  });
});
