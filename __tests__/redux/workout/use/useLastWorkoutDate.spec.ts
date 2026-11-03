/**
 * GH-458 round 2 (review #2, issue #461): per-muscle drill-down range and the
 * "select the last-trained exercise" suggestion both need to resolve the right
 * exercise/date out of the raw store shape, independent of any component.
 */
import {findLastTrainedExerciseId, findLastWorkoutDate, findLastWorkoutDateByMuscle, findLastWorkoutDateForExercises, findLastWorkoutDateForMuscle} from '../../../../app/redux/Workout/use/useLastWorkoutDate';
import {Workout} from '../../../../app/models/entities/Workout';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Muscles} from '../../../../app/models/Muscles';
import {NormalizedState} from '../../../../app/redux/normalizedState';

const makeWorkouts = (workouts: Workout[]): NormalizedState<Workout> => ({
  byId: Object.fromEntries(workouts.map((w) => [w.id!, w])) as Record<number, Workout>,
  allIds: workouts.map((w) => w.id!),
});

const makeExercises = (exercises: Exercise[]): NormalizedState<Exercise> => ({
  byId: Object.fromEntries(exercises.map((e) => [e.id!, e])) as Record<number, Exercise>,
  allIds: exercises.map((e) => e.id!),
});

const CHEST_PRESS = {id: 1, name: 'Chest press', muscles: [{muscle: Muscles.CHEST, percent: 100}]} as unknown as Exercise;
const BICEPS_CURL = {id: 2, name: 'Biceps curl', muscles: [{muscle: Muscles.BICEPS, percent: 100}]} as unknown as Exercise;

describe('findLastWorkoutDateForMuscle / findLastWorkoutDateByMuscle (GH-458 round 2)', () => {
  it('resolves the newest workout of only the exercises that target the given muscle', () => {
    const exercises = makeExercises([CHEST_PRESS, BICEPS_CURL]);
    const workouts = makeWorkouts([
      {id: 10, exerciseId: 1, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: [{}]} as unknown as Workout, // Chest, today
      {id: 11, exerciseId: 2, start: new Date(2026, 1, 20), end: new Date(2026, 1, 20), sets: [{}]} as unknown as Workout, // Biceps, months ago
    ]);

    expect(findLastWorkoutDateForMuscle(workouts, exercises, Muscles.CHEST)?.getTime()).toBe(new Date(2026, 8, 28).getTime());
    expect(findLastWorkoutDateForMuscle(workouts, exercises, Muscles.BICEPS)?.getTime()).toBe(new Date(2026, 1, 20).getTime());
  });

  it('returns undefined for a muscle with no logged sets at all', () => {
    const exercises = makeExercises([CHEST_PRESS, BICEPS_CURL]);
    const workouts = makeWorkouts([{id: 10, exerciseId: 1, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: [{}]} as unknown as Workout]);

    expect(findLastWorkoutDateForMuscle(workouts, exercises, Muscles.BACK)).toBeUndefined();
  });

  /**
   * This is exactly review comment #2's scenario: Chest was trained today (this
   * week), Biceps was not — its own last workout is months in the past. Each
   * muscle must resolve to ITS OWN date, not the store-wide newest one.
   */
  it('gives each muscle its own last-workout date instead of the store-wide newest one', () => {
    const exercises = makeExercises([CHEST_PRESS, BICEPS_CURL]);
    const workouts = makeWorkouts([
      {id: 10, exerciseId: 1, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: [{}]} as unknown as Workout,
      {id: 11, exerciseId: 2, start: new Date(2026, 1, 20), end: new Date(2026, 1, 20), sets: [{}]} as unknown as Workout,
    ]);

    const byMuscle = findLastWorkoutDateByMuscle(workouts, exercises);

    expect(byMuscle.get(Muscles.CHEST)?.getTime()).toBe(new Date(2026, 8, 28).getTime());
    expect(byMuscle.get(Muscles.BICEPS)?.getTime()).toBe(new Date(2026, 1, 20).getTime());
    expect(byMuscle.get(Muscles.BACK)).toBeUndefined();
  });

  // GH-675: findLastWorkoutDateByMuscle now walks the workouts once for all muscles instead of once per
  // muscle. It must give exactly what the per-muscle lookup gives, for every muscle.
  it('matches findLastWorkoutDateForMuscle for every muscle (single pass, GH-675)', () => {
    const PULL_UP = {id: 3, name: 'Pull up', muscles: [{muscle: Muscles.BACK, percent: 70}, {muscle: Muscles.BICEPS, percent: 30}]} as unknown as Exercise;
    const NO_MUSCLES = {id: 4, name: 'Plank'} as unknown as Exercise;
    const exercises = makeExercises([CHEST_PRESS, BICEPS_CURL, PULL_UP, NO_MUSCLES]);
    const workouts = makeWorkouts([
      {id: 10, exerciseId: 1, start: new Date(2026, 1, 2), end: new Date(2026, 1, 2), sets: [{}]} as unknown as Workout,
      {id: 11, exerciseId: 2, start: new Date(2026, 1, 20), end: new Date(2026, 1, 20), sets: [{}]} as unknown as Workout,
      {id: 12, exerciseId: 3, start: new Date(2026, 1, 25), end: new Date(2026, 1, 25), sets: [{}]} as unknown as Workout, // newest Biceps + Back
      {id: 13, exerciseId: 3, start: new Date(2026, 2, 3), sets: []} as unknown as Workout, // no sets: not a training
      {id: 14, exerciseId: 1, start: new Date(2026, 1, 9), sets: [{}]} as unknown as Workout, // no end: start counts
      {id: 15, exerciseId: 4, start: new Date(2026, 2, 1), end: new Date(2026, 2, 1), sets: [{}]} as unknown as Workout, // no muscles
      {id: 16, exerciseId: 99, start: new Date(2026, 2, 5), end: new Date(2026, 2, 5), sets: [{}]} as unknown as Workout, // unknown exercise
      {id: 17, exerciseId: 2, sets: [{}]} as unknown as Workout, // no date at all
    ]);

    const byMuscle = findLastWorkoutDateByMuscle(workouts, exercises);
    const perMuscle = new Map([...byMuscle.keys()].map((muscle) => [muscle, findLastWorkoutDateForMuscle(workouts, exercises, muscle)]));

    expect(byMuscle).toEqual(perMuscle);
    expect(byMuscle.get(Muscles.CHEST)).toEqual(new Date(2026, 1, 9));
    expect(byMuscle.get(Muscles.BICEPS)).toEqual(new Date(2026, 1, 25));
    expect(byMuscle.get(Muscles.BACK)).toEqual(new Date(2026, 1, 25));
  });
});

describe('findLastTrainedExerciseId (GH-458 round 2, issue #461)', () => {
  it('resolves the exercise of the most recently logged workout', () => {
    const workouts = makeWorkouts([
      {id: 10, exerciseId: 1, start: new Date(2026, 1, 20), end: new Date(2026, 1, 20), sets: [{}]} as unknown as Workout,
      {id: 11, exerciseId: 2, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: [{}]} as unknown as Workout,
    ]);

    expect(findLastTrainedExerciseId(workouts)).toBe(2);
  });

  it('returns undefined on an empty store', () => {
    expect(findLastTrainedExerciseId(makeWorkouts([]))).toBeUndefined();
  });

  it('skips workouts with an unresolvable date, per the "undefined" byId key in exported fixtures', () => {
    const workouts = makeWorkouts([{id: 10, exerciseId: 1, start: undefined, end: undefined, sets: [{}]} as unknown as Workout]);
    expect(findLastTrainedExerciseId(workouts)).toBeUndefined();
  });
});

/**
 * GH-458 round 3 (review #6): a workout with no logged set is not "trained".
 * The Analyse chart's empty state and the Dashboard's muscle drill-down both
 * read these helpers and used to point at the date of an empty session.
 */
describe('workouts without any set do not count as trained (GH-458 round 3)', () => {
  const emptySession = {id: 12, exerciseId: 1, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: []} as unknown as Workout;
  const realSession = {id: 10, exerciseId: 1, start: new Date(2026, 5, 3), end: new Date(2026, 5, 3), sets: [{}]} as unknown as Workout;

  it('resolves the last exercise date to the newest workout WITH sets', () => {
    const workouts = makeWorkouts([realSession, emptySession]);

    expect(findLastWorkoutDateForExercises(workouts, [1])?.getTime()).toBe(new Date(2026, 5, 3).getTime());
  });

  it('treats an exercise whose only workouts are empty as never trained', () => {
    expect(findLastWorkoutDateForExercises(makeWorkouts([emptySession]), [1])).toBeUndefined();
  });

  it('points the muscle drill-down at the last real set, not the empty session', () => {
    const exercises = makeExercises([CHEST_PRESS]);
    const workouts = makeWorkouts([realSession, emptySession]);

    expect(findLastWorkoutDateForMuscle(workouts, exercises, Muscles.CHEST)?.getTime()).toBe(new Date(2026, 5, 3).getTime());
  });

  it('does not suggest the exercise of an empty session', () => {
    const otherReal = {id: 11, exerciseId: 2, start: new Date(2026, 6, 1), end: new Date(2026, 6, 1), sets: [{}]} as unknown as Workout;

    expect(findLastTrainedExerciseId(makeWorkouts([emptySession, realSession, otherReal]))).toBe(2);
  });
});

describe('findLastWorkoutDate skips empty sessions (GH-458 round 3)', () => {
  it('ignores a newer workout with no sets', () => {
    const real = {id: 10, exerciseId: 1, start: new Date(2026, 1, 27), end: new Date(2026, 1, 27), sets: [{}]} as unknown as Workout;
    const empty = {id: 12, exerciseId: 1, start: new Date(2026, 2, 20), end: new Date(2026, 2, 20), sets: []} as unknown as Workout;

    expect(findLastWorkoutDate(makeWorkouts([real, empty]))?.getTime()).toBe(new Date(2026, 1, 27).getTime());
    expect(findLastWorkoutDate(makeWorkouts([empty]))).toBeUndefined();
  });
});
