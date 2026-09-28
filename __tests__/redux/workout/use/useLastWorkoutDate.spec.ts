/**
 * GH-458 round 2 (review #2, issue #461): per-muscle drill-down range and the
 * "select the last-trained exercise" suggestion both need to resolve the right
 * exercise/date out of the raw store shape, independent of any component.
 */
import {findLastTrainedExerciseId, findLastWorkoutDateByMuscle, findLastWorkoutDateForMuscle} from '../../../../app/redux/Workout/use/useLastWorkoutDate';
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
      {id: 10, exerciseId: 1, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: []} as unknown as Workout, // Chest, today
      {id: 11, exerciseId: 2, start: new Date(2026, 1, 20), end: new Date(2026, 1, 20), sets: []} as unknown as Workout, // Biceps, months ago
    ]);

    expect(findLastWorkoutDateForMuscle(workouts, exercises, Muscles.CHEST)?.getTime()).toBe(new Date(2026, 8, 28).getTime());
    expect(findLastWorkoutDateForMuscle(workouts, exercises, Muscles.BICEPS)?.getTime()).toBe(new Date(2026, 1, 20).getTime());
  });

  it('returns undefined for a muscle with no logged sets at all', () => {
    const exercises = makeExercises([CHEST_PRESS, BICEPS_CURL]);
    const workouts = makeWorkouts([{id: 10, exerciseId: 1, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: []} as unknown as Workout]);

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
      {id: 10, exerciseId: 1, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: []} as unknown as Workout,
      {id: 11, exerciseId: 2, start: new Date(2026, 1, 20), end: new Date(2026, 1, 20), sets: []} as unknown as Workout,
    ]);

    const byMuscle = findLastWorkoutDateByMuscle(workouts, exercises);

    expect(byMuscle.get(Muscles.CHEST)?.getTime()).toBe(new Date(2026, 8, 28).getTime());
    expect(byMuscle.get(Muscles.BICEPS)?.getTime()).toBe(new Date(2026, 1, 20).getTime());
    expect(byMuscle.get(Muscles.BACK)).toBeUndefined();
  });
});

describe('findLastTrainedExerciseId (GH-458 round 2, issue #461)', () => {
  it('resolves the exercise of the most recently logged workout', () => {
    const workouts = makeWorkouts([
      {id: 10, exerciseId: 1, start: new Date(2026, 1, 20), end: new Date(2026, 1, 20), sets: []} as unknown as Workout,
      {id: 11, exerciseId: 2, start: new Date(2026, 8, 28), end: new Date(2026, 8, 28), sets: []} as unknown as Workout,
    ]);

    expect(findLastTrainedExerciseId(workouts)).toBe(2);
  });

  it('returns undefined on an empty store', () => {
    expect(findLastTrainedExerciseId(makeWorkouts([]))).toBeUndefined();
  });

  it('skips workouts with an unresolvable date, per the "undefined" byId key in exported fixtures', () => {
    const workouts = makeWorkouts([{id: 10, exerciseId: 1, start: undefined, end: undefined, sets: []} as unknown as Workout]);
    expect(findLastTrainedExerciseId(workouts)).toBeUndefined();
  });
});
