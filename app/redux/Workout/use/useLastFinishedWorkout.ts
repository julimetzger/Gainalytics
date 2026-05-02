import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';

// Returns the most recently FINISHED workout for an exercise, or undefined.
// "Last training" baseline must never be the in-progress workout — otherwise
// the Estimated 1RM card's `vs last` reference drifts mid-session as the user
// logs sets in the current training (GH-195 P1).
export const useLastFinishedWorkout = (exercise: Exercise): Workout | undefined => {
  const exerciseId = exercise.id;
  return useSelector((state: GlobalState) => {
    if (exerciseId === undefined) return undefined;
    const workoutIds = state.workouts.byExerciseId?.[exerciseId];
    if (!workoutIds || workoutIds.length === 0) return undefined;
    for (let i = workoutIds.length - 1; i >= 0; i--) {
      const workout = state.workouts.byId[workoutIds[i]];
      if (workout && workout.end !== undefined) return workout;
    }
    return undefined;
  });
};
