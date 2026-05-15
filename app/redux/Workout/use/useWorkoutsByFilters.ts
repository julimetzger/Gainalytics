import {useSelector} from 'react-redux';
import {createSelector} from '@reduxjs/toolkit';
import {GlobalState} from '../../rootReducer';
import {Muscles} from '../../../models/Muscles';

// Stable ref for the no-results branch. Returned whenever the filtered set
// is empty so consumers get a consistent reference and avoid needless re-renders.
const EMPTY_IDS: number[] = [];

const selectAllIds = (state: GlobalState) => state.workouts.allIds;
const selectById = (state: GlobalState) => state.workouts.byId;
const selectExercisesById = (state: GlobalState) => state.exercises.byId;
const selectMusclesArg = (_: GlobalState, muscles: Muscles[]) => muscles;
const selectExerciseIdsArg = (_: GlobalState, _m: Muscles[], exerciseIds: number[]) => exerciseIds;

const workoutTimestamp = (end: Date | undefined, start: Date | undefined): number => {
  const date = end ?? start;
  return date ? new Date(date).getTime() : 0;
};

// Returns sorted workout IDs (newest-first) matching the supplied filter tuple.
// When both arrays are empty, all started workouts are returned (no-filter path).
// OR semantics: a workout matches if its exerciseId is in exerciseIds OR its
// exercise has at least one muscle in muscles.
const selectWorkoutsByFilters = createSelector(
  [selectAllIds, selectById, selectExercisesById, selectMusclesArg, selectExerciseIdsArg],
  (allIds, byId, exercisesById, muscles, exerciseIds) => {
    const noFilter = muscles.length === 0 && exerciseIds.length === 0;
    const muscleSet = muscles.length > 0 ? new Set(muscles) : null;
    const exerciseIdSet = exerciseIds.length > 0 ? new Set(exerciseIds) : null;

    const filtered = allIds.filter((id) => {
      const workout = byId[id];
      if (!workout?.start) return false;
      if (noFilter) return true;
      if (exerciseIdSet?.has(workout.exerciseId)) return true;
      if (muscleSet) {
        const exercise = exercisesById[workout.exerciseId];
        return exercise?.muscles?.some((mp) => mp.muscle !== undefined && muscleSet.has(mp.muscle)) ?? false;
      }
      return false;
    });

    if (filtered.length === 0) return EMPTY_IDS;

    return [...filtered].sort(
      (a, b) =>
        workoutTimestamp(byId[b]?.end as Date | undefined, byId[b]?.start as Date | undefined) -
        workoutTimestamp(byId[a]?.end as Date | undefined, byId[a]?.start as Date | undefined),
    );
  },
);

export const useWorkoutsByFilters = (muscles: Muscles[], exerciseIds: number[]): number[] =>
  useSelector((state: GlobalState) => selectWorkoutsByFilters(state, muscles, exerciseIds));
