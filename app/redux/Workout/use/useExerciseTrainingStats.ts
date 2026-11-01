import {createSelector} from '@reduxjs/toolkit';
import {useSelector} from 'react-redux';
import {Workout} from '../../../models/entities/Workout';
import {NormalizedState} from '../../normalizedState';
import {GlobalState} from '../../rootReducer';
import {ExerciseTrainingStat} from '../../../utils/filter-panel';

/**
 * GH-642: per exercise, how often it was trained and when last — feeds the
 * "most trained" quick-pick chips and the "Recent" section of the exercise
 * search sheet. Workouts without a logged set do not count as trained.
 */
export const buildExerciseTrainingStats = (workouts: NormalizedState<Workout>): Record<number, ExerciseTrainingStat> => {
  const stats: Record<number, ExerciseTrainingStat> = {};
  workouts.allIds.forEach((workoutId) => {
    const workout = workouts.byId[workoutId];
    if (!workout?.sets?.length || workout.exerciseId === undefined) {
      return;
    }
    const timestamp = new Date(workout.end ?? workout.start ?? NaN).getTime();
    const current = stats[workout.exerciseId] ?? {count: 0, last: 0};
    stats[workout.exerciseId] = {count: current.count + 1, last: Number.isFinite(timestamp) ? Math.max(current.last, timestamp) : current.last};
  });
  return stats;
};

const selector = createSelector((state: GlobalState) => state.workouts, buildExerciseTrainingStats);

export const useExerciseTrainingStats = () => useSelector(selector);
