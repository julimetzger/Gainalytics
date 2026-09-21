import {createSelector} from '@reduxjs/toolkit';
import {useSelector} from 'react-redux';
import {Workout} from '../../../models/entities/Workout';
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

const selectWorkouts = (state: GlobalState) => state.workouts;

const selector = createSelector(selectWorkouts, findLastWorkoutDate);

export const useLastWorkoutDate = () => useSelector(selector);
