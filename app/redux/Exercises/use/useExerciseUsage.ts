import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {TrainingsState} from '../../../models/TrainingsState';

export interface ExerciseUsage {
  /** The exercise is part of a training that is running right now. */
  inRunningTraining: boolean;
  /** Sets already logged for the exercise in the running training. */
  runningTrainingSets: number;
  /** Trainings that are planned (not started) and contain the exercise. */
  plannedTrainings: number;
  /** Logged workouts of the exercise, including one in a running training. */
  loggedWorkouts: number;
  /** Logged sets over all of those workouts. */
  loggedSets: number;
}

const NO_USAGE: ExerciseUsage = {inRunningTraining: false, runningTrainingSets: 0, plannedTrainings: 0, loggedWorkouts: 0, loggedSets: 0};

/** GH-486: what deleting an exercise takes with it — shown in the delete dialog before the user confirms. */
export const selectExerciseUsage = (state: GlobalState, exerciseId: number | undefined): ExerciseUsage => {
  if (exerciseId === undefined) return NO_USAGE;
  let inRunningTraining = false;
  let runningTrainingSets = 0;
  let plannedTrainings = 0;
  Object.values(state.trainings?.byId ?? {}).forEach((training) => {
    if (!(training.exercises ?? []).includes(exerciseId)) return;
    if (training.state === TrainingsState.STARTED) {
      inRunningTraining = true;
      const doneWorkoutId = training.doneWorkoutIds?.[exerciseId];
      runningTrainingSets += doneWorkoutId !== undefined ? state.workouts.byId[doneWorkoutId]?.sets?.length ?? 0 : 0;
    } else if (training.state !== TrainingsState.FINISHED) {
      plannedTrainings += 1;
    }
  });
  const workouts = (state.workouts.byExerciseId?.[exerciseId] ?? []).map((workoutId) => state.workouts.byId[workoutId]).filter((workout) => workout !== undefined);
  return {
    inRunningTraining,
    runningTrainingSets,
    plannedTrainings,
    loggedWorkouts: workouts.length,
    loggedSets: workouts.reduce((sum, workout) => sum + (workout.sets?.length ?? 0), 0),
  };
};

export const useExerciseUsage = (exerciseId: number | undefined): ExerciseUsage =>
  useSelector((state: GlobalState) => selectExerciseUsage(state, exerciseId), shallowEqual);
