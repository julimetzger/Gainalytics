import {AnyAction} from '@reduxjs/toolkit';
import {GlobalState} from '../rootReducer';
import {TrainingsPlanExportPayload} from '../../utils/exportTrainingsPlan';
import {Exercise} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';
import {Training} from '../../models/entities/Training';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';

const fullStateReducer = (state: GlobalState, action: AnyAction) => {
  switch (action.type) {
    case 'FULL_IMPORT':
      return action.state;
    case 'IMPORT_TRAININGS_PLAN': {
      const payload = action.payload as TrainingsPlanExportPayload;

      // 1. Map Exercises (match by name)
      const exerciseIdMap: Record<number, number> = {};
      const newExercises = {...state.exercises.byId};
      const newExerciseIds = [...state.exercises.allIds];
      let maxExerciseId = Math.max(0, ...newExerciseIds);

      payload.exercises.forEach((importedEx) => {
        const existingEx = Object.values(newExercises).find((ex) => ex.name.toLowerCase() === importedEx.name.toLowerCase());
        if (existingEx) {
          exerciseIdMap[importedEx.id!!] = existingEx.id!!;
        } else {
          maxExerciseId++;
          const newEx: Exercise = {...importedEx, id: maxExerciseId};
          newExercises[maxExerciseId] = newEx;
          newExerciseIds.push(maxExerciseId);
          exerciseIdMap[importedEx.id!!] = maxExerciseId;
        }
      });

      // 2. Map Workouts (new IDs)
      const workoutIdMap: Record<number, number> = {};
      const newWorkouts = {...state.workouts.byId};
      const newWorkoutIds = [...state.workouts.allIds];
      let maxWorkoutId = Math.max(0, ...newWorkoutIds);

      payload.workouts.forEach((importedWorkout) => {
        maxWorkoutId++;
        const newWorkout: Workout = {
          ...importedWorkout,
          id: maxWorkoutId,
          exerciseId: exerciseIdMap[importedWorkout.exerciseId],
        };
        newWorkouts[maxWorkoutId] = newWorkout;
        newWorkoutIds.push(maxWorkoutId);
        workoutIdMap[importedWorkout.id!!] = maxWorkoutId;
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
      let maxPlanId = Math.max(0, ...newTrainingsPlanIds);
      maxPlanId++;

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
          allIds: newWorkoutIds,
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
    default:
      return state;
  }
};

export default fullStateReducer;
