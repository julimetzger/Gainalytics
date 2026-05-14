import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {createSelector} from '@reduxjs/toolkit';
import {NormalizedWorkoutState} from '../../normalizedWorkoutState';
import {Workout} from '../../../models/entities/Workout';

// Timestamp a workout is sorted by in History: prefer `end` (when it was
// finished), fall back to `start` (in-progress workouts still show up).
const workoutTimestamp = (workout: Workout | undefined): number => {
  const date = workout?.end ?? workout?.start;
  return date ? new Date(date).getTime() : 0;
};

// Returns the ids of all begun workouts (start !== undefined) — including
// in-progress ones — sorted by their timestamp (end ?? start) descending.
// Sorting here, before History paginates, guarantees backdated or imported
// workouts (whose insertion order in allIds is not chronological, and
// FINALIZE_WORKOUT updates `end` without reordering) still land on the first
// page instead of being sliced off.
const selectAllWorkoutIds = createSelector(
  (state: GlobalState) => state.workouts,
  (workouts: NormalizedWorkoutState<Workout>) =>
    [...workouts.allIds]
      .filter(id => workouts.byId[id]?.start !== undefined)
      .sort((a, b) => workoutTimestamp(workouts.byId[b]) - workoutTimestamp(workouts.byId[a])),
);

export const useAllWorkoutIds = () => useSelector(selectAllWorkoutIds);
