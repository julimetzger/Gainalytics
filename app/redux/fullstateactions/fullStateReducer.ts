import {AnyAction} from '@reduxjs/toolkit';
import {GlobalState} from '../rootReducer';
import {TrainingsPlanExportPayload} from '../../utils/exportTrainingsPlan';
import {Exercise} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';
import {Training} from '../../models/entities/Training';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {determineNewWorkoutId} from '../normalizedWorkoutState';
import {removeDanglingExerciseReferences} from './removeDanglingExerciseReferences';
import {normalizeExerciseName} from '../../utils/program-templates';

const sanitizeTrainingWorkoutReferences = (fullImportedState: GlobalState): GlobalState => {
  const validWorkoutIds = new Set(Object.keys(fullImportedState.workouts.byId).map((workoutId) => Number(workoutId)));
  const validExerciseIds = new Set(Object.keys(fullImportedState.exercises.byId).map((exerciseId) => Number(exerciseId)));

  const sanitizedTrainingsById = Object.fromEntries(
    Object.entries(fullImportedState.trainings.byId).map(([trainingId, training]) => {
      const sanitizeWorkoutMap = (map: {[exerciseId: number]: number} = {}) =>
        Object.fromEntries(
          Object.entries(map).filter(([exerciseId, workoutId]) => {
            return validExerciseIds.has(Number(exerciseId)) && validWorkoutIds.has(Number(workoutId));
          }),
        );

      const sanitizedTraining: Training = {
        ...training,
        exercises: (training.exercises ?? []).filter((exerciseId) => validExerciseIds.has(Number(exerciseId))),
        plannedWorkouts: sanitizeWorkoutMap(training.plannedWorkouts),
        doneWorkoutIds: sanitizeWorkoutMap(training.doneWorkoutIds),
      };

      return [trainingId, sanitizedTraining];
    }),
  ) as {[trainingId: number]: Training};

  return {
    ...fullImportedState,
    trainings: {
      ...fullImportedState.trainings,
      byId: sanitizedTrainingsById,
    },
  };
};

const fullStateReducer = (state: GlobalState, action: AnyAction) => {
  switch (action.type) {
    case 'FULL_IMPORT': {
      const importedState: GlobalState = {
        ...action.state,
        videoAnalyses: action.state.videoAnalyses ?? state.videoAnalyses,
        aiChat: action.state.aiChat ?? state.aiChat,
        // GH-497: a backup from before the onboarding existed must not bring it back.
        settings:
          action.state.settings && state.settings?.onboardingCompleted
            ? {...action.state.settings, onboardingCompleted: true}
            : action.state.settings,
      };
      return sanitizeTrainingWorkoutReferences(importedState);
    }
    case 'IMPORT_TRAININGS_PLAN': {
      const payload = action.payload as TrainingsPlanExportPayload;

      // 1. Map Exercises (match by name)
      const exerciseIdMap: Record<number, number> = {};
      const newExercises = {...state.exercises.byId};
      const newExerciseIds = [...state.exercises.allIds];
      let maxExerciseId = Math.max(0, ...newExerciseIds);

      payload.exercises.forEach((importedEx) => {
        const existingEx = Object.values(newExercises).find((ex) => normalizeExerciseName(ex.name) === normalizeExerciseName(importedEx.name));
        if (existingEx) {
          exerciseIdMap[importedEx.id!!] = existingEx.id!!;
        } else {
          maxExerciseId++;
          // A shared plan must never install the sender's VL reference here (issue #316).
          // New exports already drop it; strip it again so older plan files cannot leak one.
          const {vlReference: _senderReference, ...importedExercise} = importedEx;
          const newEx: Exercise = {...importedExercise, id: maxExerciseId};
          newExercises[maxExerciseId] = newEx;
          newExerciseIds.push(maxExerciseId);
          exerciseIdMap[importedEx.id!!] = maxExerciseId;
        }
      });

      // 2. Map Workouts (new IDs). They are planned workouts, so they belong in
      // `plannedWorkouts` like the ones planned in the app — `allIds` lists logged
      // workouts, and history / last-workout dates read it (GH-497).
      const workoutIdMap: Record<number, number> = {};
      const newWorkouts = {...state.workouts.byId};
      const newPlannedWorkoutIds = [...(state.workouts.plannedWorkouts ?? [])];
      let nextWorkoutId = determineNewWorkoutId(state.workouts);

      payload.workouts.forEach((importedWorkout) => {
        const newWorkoutId = nextWorkoutId;
        nextWorkoutId++;
        const newWorkout: Workout = {
          ...importedWorkout,
          id: newWorkoutId,
          exerciseId: exerciseIdMap[importedWorkout.exerciseId],
        };
        newWorkouts[newWorkoutId] = newWorkout;
        newPlannedWorkoutIds.push(newWorkoutId);
        workoutIdMap[importedWorkout.id!!] = newWorkoutId;
      });

      // 3. Map Trainings (new IDs)
      const trainingIdMap: Record<number, number> = {};
      const newTrainings = {...state.trainings.byId};
      const newTrainingIds = [...state.trainings.allIds];
      let maxTrainingId = Math.max(0, ...newTrainingIds);

      payload.trainings.forEach((importedTraining) => {
        maxTrainingId++;
        const newPlannedWorkouts: Record<number, number> = {};
        Object.entries(importedTraining.plannedWorkouts ?? {}).forEach(([exId, wId]) => {
          newPlannedWorkouts[exerciseIdMap[Number(exId)]] = workoutIdMap[wId];
        });

        const newTraining: Training = {
          ...importedTraining,
          id: maxTrainingId,
          exercises: importedTraining.exercises.map((id) => exerciseIdMap[id]),
          plannedWorkouts: newPlannedWorkouts,
          doneWorkoutIds: {}, // Ensure it's empty as per export specs
        };
        newTrainings[maxTrainingId] = newTraining;
        newTrainingIds.push(maxTrainingId);
        trainingIdMap[importedTraining.id!!] = maxTrainingId;
      });

      // 4. Map TrainingsPlan (new ID)
      const newTrainingsPlans = {...state.trainingsPlan.byId};
      const newTrainingsPlanIds = [...state.trainingsPlan.allIds];
      // A caller may reserve the id up front (GH-497: it then knows the created plan
      // without reading the store back); a taken or missing one falls back to the next free id.
      const requestedPlanId = action.planId as number | undefined;
      const maxPlanId =
        requestedPlanId !== undefined && state.trainingsPlan.byId[requestedPlanId] === undefined ? requestedPlanId : Math.max(0, ...newTrainingsPlanIds) + 1;

      const newPlanTrainings: Record<string, number> = {};
      Object.entries(payload.trainingsPlan.trainings ?? {}).forEach(([key, tId]) => {
        newPlanTrainings[key] = trainingIdMap[tId];
      });

      const newPlan: TrainingsPlan = {
        ...payload.trainingsPlan,
        id: maxPlanId,
        trainings: newPlanTrainings,
      };
      newTrainingsPlans[maxPlanId] = newPlan;
      newTrainingsPlanIds.push(maxPlanId);

      return {
        ...state,
        exercises: {
          ...state.exercises,
          byId: newExercises,
          allIds: newExerciseIds,
        },
        workouts: {
          ...state.workouts,
          byId: newWorkouts,
          plannedWorkouts: newPlannedWorkoutIds,
        },
        trainings: {
          ...state.trainings,
          byId: newTrainings,
          allIds: newTrainingIds,
        },
        trainingsPlan: {
          ...state.trainingsPlan,
          byId: newTrainingsPlans,
          allIds: newTrainingsPlanIds,
        },
      };
    }
    // GH-486: the slice reducers have already removed the exercise and its logged workouts;
    // trainings (incl. a running one) and planned workouts must not keep pointing at it.
    case 'DELETE_EXERCISE':
    case 'REPAIR_DANGLING_EXERCISE_REFERENCES':
      return removeDanglingExerciseReferences(state);
    default:
      return state;
  }
};

export default fullStateReducer;
