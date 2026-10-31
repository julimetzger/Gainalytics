import {NormalizedState} from '../normalizedState';
import {AnyAction} from '@reduxjs/toolkit';
import {TrainingsState} from '../../models/TrainingsState';
import {Training} from '../../models/entities/Training';
import {Exercise} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';

const initialState = {
  byId: {},
  allIds: [],
} as NormalizedState<Training>;

const trainingsReducer = (state: NormalizedState<Training> = initialState, action: AnyAction) => {
  function createTrainingIfNotPresent(trainingsId: number, training: Training, allIds: number[]) {
    if (trainingsId === undefined) {
      trainingsId = action.nextTrainingsId;
      training = {
        ...action.trainingsPlan,
        id: trainingsId,
        doneWorkoutIds: {},
        plannedWorkouts: {},
        exercises: action.exerciseId ? [action.exerciseId] : [],
        state: TrainingsState.PLANNED,
      };
      allIds.push(trainingsId);
    }
    return {trainingsId, training};
  }

  function addPlannedWorkout(training: Training) {
    if (action.workout?.id === undefined) {
      training.plannedWorkouts = {
        ...training.plannedWorkouts,
        [action.exerciseId]: action.nextWorkoutId,
      };
    }
  }

  let trainingsId = action.trainingsId;
  let training = {...state.byId[trainingsId]};
  let allIds = [...state.allIds];
  switch (action.type) {
    case 'ADD_PLANED_TRAINING_WORKOUT':
      const __ret = createTrainingIfNotPresent(trainingsId, training, allIds);
      trainingsId = __ret.trainingsId;
      training = __ret.training;
      addPlannedWorkout(training);
      return {
        ...state,
        byId: {
          ...state.byId,
          [trainingsId]: training,
        },
        allIds: [...allIds],
      };
    case 'MODIFY_EXERCISES_IN_TRAINING':
      // TODO should workouts be deleted if exercise is removed?
      const ret = createTrainingIfNotPresent(trainingsId, training, allIds);
      trainingsId = ret.trainingsId;
      training = ret.training;
      training.exercises = action.exercises.map((exercise: Exercise) => exercise.id);
      return {
        ...state,
        byId: {
          ...state.byId,
          [trainingsId]: training,
        },
        allIds: [...allIds],
      };
    case 'REPLACE_EXERCISE_IN_TRAINING': {
      const existingTraining = state.byId[action.trainingsId];
      if (
        existingTraining === undefined ||
        existingTraining.state === TrainingsState.FINISHED ||
        action.fromExerciseId === action.toExerciseId ||
        !existingTraining.exercises.includes(action.fromExerciseId) ||
        existingTraining.exercises.includes(action.toExerciseId)
      ) {
        return state;
      }

      const nextExercises = existingTraining.exercises.map((exerciseId) => (exerciseId === action.fromExerciseId ? action.toExerciseId : exerciseId));
      const fromPlannedWorkoutId = existingTraining.plannedWorkouts?.[action.fromExerciseId];
      const fromDoneWorkoutId = existingTraining.doneWorkoutIds?.[action.fromExerciseId];
      const plannedWithoutOld = Object.fromEntries(Object.entries(existingTraining.plannedWorkouts ?? {}).filter(([exerciseId]) => parseInt(exerciseId) !== action.fromExerciseId));
      const doneWithoutOld = Object.fromEntries(Object.entries(existingTraining.doneWorkoutIds ?? {}).filter(([exerciseId]) => parseInt(exerciseId) !== action.fromExerciseId));

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsId]: {
            ...existingTraining,
            exercises: nextExercises,
            plannedWorkouts: fromPlannedWorkoutId !== undefined ? {...plannedWithoutOld, [action.toExerciseId]: fromPlannedWorkoutId} : plannedWithoutOld,
            doneWorkoutIds: fromDoneWorkoutId !== undefined ? {...doneWithoutOld, [action.toExerciseId]: fromDoneWorkoutId} : doneWithoutOld,
          },
        },
      };
    }
    case 'ADD_WORKOUT':
      if (action.trainingsId === undefined) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsId]: {
            ...state.byId[action.trainingsId],
            doneWorkoutIds: {
              ...state.byId[action.trainingsId].doneWorkoutIds,
              [action.workout.exerciseId]: action.nextWorkoutId,
            },
          },
        },
      };
    case 'FINISH_TRAINING':
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsId]: {
            ...state.byId[action.trainingsId],
            state: TrainingsState.FINISHED,
            end: action.date,
          },
        },
      };
    case 'EDIT_TRAINING_TIMES':
      if (action.trainingsId === undefined || state.byId[action.trainingsId] === undefined) {
        return state;
      }
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsId]: {
            ...state.byId[action.trainingsId],
            start: action.start,
            end: action.end,
          },
        },
      };
    case 'START_TRAINING':
      if (state.byId[action.trainingsId].state === TrainingsState.STARTED) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsId]: {
            ...state.byId[action.trainingsId],
            state: TrainingsState.STARTED,
            start: action.date,
          },
        },
      };
    case 'DELETE_WORKOUT':
      if (action.workout?.id === undefined) {
        return state;
      }
      let hasChanges = false;
      const byId = Object.fromEntries(
        Object.entries(state.byId).map(([id, existingTraining]) => {
          const cleanedDoneWorkoutIds = Object.fromEntries(Object.entries(existingTraining.doneWorkoutIds ?? {}).filter(([, workoutId]) => workoutId !== action.workout.id));
          const cleanedPlannedWorkouts = Object.fromEntries(Object.entries(existingTraining.plannedWorkouts ?? {}).filter(([, workoutId]) => workoutId !== action.workout.id));
          if (
            Object.keys(cleanedDoneWorkoutIds).length !== Object.keys(existingTraining.doneWorkoutIds ?? {}).length ||
            Object.keys(cleanedPlannedWorkouts).length !== Object.keys(existingTraining.plannedWorkouts ?? {}).length
          ) {
            hasChanges = true;
          }
          return [
            id,
            {
              ...existingTraining,
              doneWorkoutIds: cleanedDoneWorkoutIds,
              plannedWorkouts: cleanedPlannedWorkouts,
            },
          ];
        }),
      ) as {[trainingsId: number]: Training};
      if (!hasChanges) {
        return state;
      }
      return {
        ...state,
        byId,
      };
    case 'SUGGEST_TRAINING':
      const __rets = createTrainingIfNotPresent(trainingsId, training, allIds);
      trainingsId = __rets.trainingsId;
      training = __rets.training;
      let workoutIdMap = action.workoutIdWorkoutMap as Map<number, Workout>;
      workoutIdMap.forEach((workout: Workout, workoutId: number) => {
        training.plannedWorkouts = {
          ...training.plannedWorkouts,
          [workout.exerciseId]: workoutId,
        };
      });
      // GH-544: "Plan with AI" passes its own exercise order (swaps, removals).
      training.exercises = action.exercises ?? action.lastTrainingInMicro.exercises;
      return {
        ...state,
        byId: {
          ...state.byId,
          [trainingsId]: training,
        },
        allIds: [...allIds],
      };
    case 'DELETE_TRAINING': {
      if (action.trainingsId === undefined || state.byId[action.trainingsId] === undefined) return state;
      const byId = {...state.byId};
      delete byId[action.trainingsId];
      return {
        ...state,
        byId,
        allIds: state.allIds.filter((id) => id !== action.trainingsId),
      };
    }
    case 'CLEAR_PLANNED_TRAINING': {
      // GH-442: only a not-yet-started training may be emptied; the training and its
      // plan slot stay, only the planned exercises and their workouts go.
      const existingTraining = state.byId[action.trainingsId];
      if (existingTraining === undefined || existingTraining.state !== TrainingsState.PLANNED) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsId]: {
            ...existingTraining,
            exercises: [],
            plannedWorkouts: {},
          },
        },
      };
    }
    default:
      return state;
  }
};
export default trainingsReducer;
