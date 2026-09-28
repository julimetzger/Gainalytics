import {createSelector} from '@reduxjs/toolkit';
import {useSelector} from 'react-redux';
import {Workout} from '../../../models/entities/Workout';
import {Exercise} from '../../../models/entities/Exercise';
import {Muscles} from '../../../models/Muscles';
import {NormalizedState} from '../../normalizedState';
import {GlobalState} from '../../rootReducer';

/**
 * GH-458 (H4/H5): the newest logged workout in the whole store, regardless of
 * any screen's date range.
 *
 * Every Analyse screen starts on a default range ("last 3 months", "this week",
 * "last year"). A user who paused for a few months therefore sees emptiness
 * everywhere and nothing tells them that data exists — just earlier. Knowing the
 * last training date is what lets a screen say so and offer a one-tap fix.
 *
 * Ids that do not resolve to a dated workout are skipped: the exported `.gains`
 * fixtures carry a literal "undefined" key in `byId`, so a plain Math.max over
 * the ids yields NaN.
 */
export const findLastWorkoutDate = (workouts: NormalizedState<Workout>): Date | undefined => {
  const newestTimestamp = workouts.allIds.reduce<number | undefined>((newest, workoutId) => {
    const workout = workouts.byId[workoutId];
    const timestamp = new Date(workout?.end ?? workout?.start ?? NaN).getTime();
    if (!Number.isFinite(timestamp)) {
      return newest;
    }

    return newest === undefined || timestamp > newest ? timestamp : newest;
  }, undefined);

  return newestTimestamp === undefined ? undefined : new Date(newestTimestamp);
};

/**
 * GH-458 (H3): the newest logged workout for a given set of exercises.
 *
 * The Analyse chart rendered the same blank box for "the range holds nothing",
 * "this exercise was never trained" and "something broke". Knowing whether the
 * selection has any history at all is what tells those cases apart, and the
 * date is what a "jump to the last training" action needs.
 */
export const findLastWorkoutDateForExercises = (workouts: NormalizedState<Workout>, exerciseIds: number[]): Date | undefined => {
  if (exerciseIds.length === 0) {
    return undefined;
  }

  const wantedIds = new Set(exerciseIds);
  const newestTimestamp = workouts.allIds.reduce<number | undefined>((newest, workoutId) => {
    const workout = workouts.byId[workoutId];
    if (!workout || !wantedIds.has(workout.exerciseId)) {
      return newest;
    }

    const timestamp = new Date(workout.end ?? workout.start ?? NaN).getTime();
    if (!Number.isFinite(timestamp)) {
      return newest;
    }

    return newest === undefined || timestamp > newest ? timestamp : newest;
  }, undefined);

  return newestTimestamp === undefined ? undefined : new Date(newestTimestamp);
};

/**
 * GH-458 round 2 (review #2): the muscle-chip drill-down used to open every
 * muscle on the current-week range, so tapping a muscle that was not trained
 * this week (while others were) landed on an empty table for exactly that
 * muscle. This resolves, per muscle, the newest workout of any exercise that
 * targets it — the Dashboard picks the current week when that is non-empty
 * and this date otherwise.
 */
export const findLastWorkoutDateForMuscle = (workouts: NormalizedState<Workout>, exercises: NormalizedState<Exercise>, muscle: Muscles): Date | undefined => {
  const exerciseIds = exercises.allIds.filter((id) => exercises.byId[id]?.muscles?.some((pair) => pair.muscle === muscle));
  return findLastWorkoutDateForExercises(workouts, exerciseIds);
};

export const findLastWorkoutDateByMuscle = (workouts: NormalizedState<Workout>, exercises: NormalizedState<Exercise>): Map<Muscles, Date | undefined> =>
  new Map(Object.values(Muscles).map((muscle) => [muscle, findLastWorkoutDateForMuscle(workouts, exercises, muscle)]));

/**
 * GH-458 round 2 (issue #461): "Nothing to chart yet" used to leave the user
 * with no next step beyond re-opening the picker themselves. The newest
 * logged workout's exercise is a reasonable one-tap suggestion.
 */
export const findLastTrainedExerciseId = (workouts: NormalizedState<Workout>): number | undefined => {
  let newestTimestamp: number | undefined;
  let newestExerciseId: number | undefined;

  workouts.allIds.forEach((workoutId) => {
    const workout = workouts.byId[workoutId];
    const timestamp = new Date(workout?.end ?? workout?.start ?? NaN).getTime();
    if (!workout || !Number.isFinite(timestamp)) {
      return;
    }
    if (newestTimestamp === undefined || timestamp > newestTimestamp) {
      newestTimestamp = timestamp;
      newestExerciseId = workout.exerciseId;
    }
  });

  return newestExerciseId;
};

const selectWorkouts = (state: GlobalState) => state.workouts;
const selectExercises = (state: GlobalState) => state.exercises;

const selector = createSelector(selectWorkouts, findLastWorkoutDate);

export const useLastWorkoutDate = () => useSelector(selector);

export const useLastWorkoutDateForExercises = (exerciseIds: number[]) =>
  useSelector(
    (state: GlobalState) => findLastWorkoutDateForExercises(state.workouts, exerciseIds),
    // The caller derives the id list on every render, so the selector result is
    // a fresh Date each time. Compare by value to keep the screen from looping.
    (left, right) => left?.getTime() === right?.getTime(),
  );

const byMuscleSelector = createSelector(selectWorkouts, selectExercises, findLastWorkoutDateByMuscle);

export const useLastWorkoutDateByMuscle = () => useSelector(byMuscleSelector);

const lastTrainedExerciseIdSelector = createSelector(selectWorkouts, findLastTrainedExerciseId);

export const useLastTrainedExerciseId = () => useSelector(lastTrainedExerciseIdSelector);
