import {useSelector} from 'react-redux';
import {createSelector} from '@reduxjs/toolkit';
import {GlobalState} from '../../rootReducer';
import {oneRepMaxForWorkouts} from '../../../utils/AnalyseUtils';
import {Workout} from '../../../models/entities/Workout';

const allTimeOneRepMax = (workoutsState: GlobalState['workouts'], exerciseId?: number): number => {
  if (exerciseId === undefined) return 0;
  const workoutIds = workoutsState.byExerciseId?.[exerciseId];
  if (!workoutIds || workoutIds.length === 0) return 0;
  const workouts = workoutIds
    .map((id) => workoutsState.byId[id])
    .filter((w): w is Workout => w !== undefined && (w as any).end !== undefined);
  if (workouts.length === 0) return 0;
  return oneRepMaxForWorkouts(...workouts);
};

export const selectAllTimeOneRepMax = (state: GlobalState, exerciseId?: number): number => allTimeOneRepMax(state.workouts, exerciseId);

/** A lookup exerciseId → all-time 1RM; only recreated when the workouts change, evaluated lazily per exercise. */
export const selectAllTimeOneRepMaxLookup = createSelector(
  (state: GlobalState) => state.workouts,
  (workoutsState) => (exerciseId: number) => allTimeOneRepMax(workoutsState, exerciseId),
);

export const useAllTimeOneRepMax = (exerciseId?: number): number => {
  return useSelector((state: GlobalState) => selectAllTimeOneRepMax(state, exerciseId));
};
