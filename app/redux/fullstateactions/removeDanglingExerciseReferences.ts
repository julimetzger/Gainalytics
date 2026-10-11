import {GlobalState} from '../rootReducer';
import {Training} from '../../models/entities/Training';
import {Workout} from '../../models/entities/Workout';

/**
 * GH-486: drops every reference to an exercise that no longer exists.
 *
 * Deleting an exercise used to leave its id in `training.exercises`,
 * `doneWorkoutIds` and `plannedWorkouts`; the training screen then looked the
 * exercise up, got `undefined` and crashed — every time the training was opened.
 *
 * Runs after DELETE_EXERCISE and once after every rehydrate, so stores that are
 * already in that broken state are repaired on the next app start. Only
 * references whose exercise is gone are touched, and the state object is
 * returned unchanged when there is nothing to repair.
 */
export const removeDanglingExerciseReferences = (state: GlobalState): GlobalState => {
  const exercisesById = state.exercises?.byId;
  // Never prune against an exercise slice that is not there at all.
  if (exercisesById === undefined || Object.keys(exercisesById).length === 0) return state;
  const exists = (exerciseId: number | string) => exercisesById[Number(exerciseId)] !== undefined;

  const trainings = repairTrainings(state, exists);
  const workouts = repairWorkouts(state, exists);
  if (trainings === state.trainings && workouts === state.workouts) return state;
  return {...state, trainings, workouts};
};

const dropMissingKeys = (map: {[exerciseId: number]: number} | undefined, exists: (id: number | string) => boolean) => {
  if (map === undefined) return map;
  const keys = Object.keys(map);
  if (keys.every(exists)) return map;
  return Object.fromEntries(Object.entries(map).filter(([exerciseId]) => exists(exerciseId)));
};

function repairTrainings(state: GlobalState, exists: (id: number | string) => boolean) {
  const trainingsById = state.trainings?.byId;
  if (trainingsById === undefined) return state.trainings;
  let changed = false;
  const byId: {[trainingId: number]: Training} = {};
  Object.entries(trainingsById).forEach(([trainingId, training]) => {
    const exercises = training.exercises?.every(exists) === false ? training.exercises.filter(exists) : training.exercises;
    const doneWorkoutIds = dropMissingKeys(training.doneWorkoutIds, exists);
    const plannedWorkouts = dropMissingKeys(training.plannedWorkouts, exists);
    if (exercises === training.exercises && doneWorkoutIds === training.doneWorkoutIds && plannedWorkouts === training.plannedWorkouts) {
      byId[Number(trainingId)] = training;
      return;
    }
    changed = true;
    byId[Number(trainingId)] = {...training, exercises, doneWorkoutIds: doneWorkoutIds!!, plannedWorkouts: plannedWorkouts!!};
  });
  return changed ? {...state.trainings, byId} : state.trainings;
}

function repairWorkouts(state: GlobalState, exists: (id: number | string) => boolean) {
  const workouts = state.workouts;
  if (workouts?.byId === undefined) return workouts;
  const orphanIds = new Set(
    Object.entries(workouts.byId)
      .filter(([, workout]) => (workout as Workout | undefined)?.exerciseId !== undefined && !exists((workout as Workout).exerciseId))
      .map(([workoutId]) => Number(workoutId)),
  );
  const byExerciseId = dropMissingKeys(workouts.byExerciseId, exists);
  const notFinishedWorkouts = dropMissingKeys(workouts.notFinishedWorkouts, exists);
  const suggestedWorkouts =
    workouts.suggestedWorkouts !== undefined && !Object.keys(workouts.suggestedWorkouts).every(exists)
      ? Object.fromEntries(Object.entries(workouts.suggestedWorkouts).filter(([exerciseId]) => exists(exerciseId)))
      : workouts.suggestedWorkouts;
  if (orphanIds.size === 0 && byExerciseId === workouts.byExerciseId && notFinishedWorkouts === workouts.notFinishedWorkouts && suggestedWorkouts === workouts.suggestedWorkouts) {
    return workouts;
  }
  const byId = {...workouts.byId};
  orphanIds.forEach((workoutId) => delete byId[workoutId]);
  return {
    ...workouts,
    byId,
    allIds: orphanIds.size === 0 ? workouts.allIds : workouts.allIds.filter((id) => !orphanIds.has(id)),
    plannedWorkouts: orphanIds.size === 0 ? workouts.plannedWorkouts : (workouts.plannedWorkouts ?? []).filter((id) => !orphanIds.has(id)),
    byExerciseId: byExerciseId ?? {},
    notFinishedWorkouts,
    suggestedWorkouts,
  };
}
