import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/entities/Workout';

export const useLastFinishedWorkoutsByExerciseIds = (exerciseIds: number[], excludeWorkoutIds?: number[]): Workout[] =>
  useSelector((state: GlobalState) => {
    const excludeSet = new Set(excludeWorkoutIds ?? []);
    return exerciseIds.flatMap(exerciseId => {
      const workoutIds = state.workouts.byExerciseId?.[exerciseId] ?? [];
      for (let i = workoutIds.length - 1; i >= 0; i--) {
        const workout = state.workouts.byId[workoutIds[i]];
        if (workout && workout.end !== undefined && !excludeSet.has(workoutIds[i])) {
          return [workout];
        }
      }
      return [];
    });
  });
