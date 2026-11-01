import {AnyAction} from 'redux';
import {GlobalState} from '../rootReducer';
import {determineNewId} from '../normalizedState';
import {determineNewWorkoutId} from '../normalizedWorkoutState';
import {Training} from '../../models/entities/Training';
import {Workout} from '../../models/entities/Workout';
import {AiPlanExercise} from '../../utils/ai/planTraining/aiPlanResult';

export interface AiPlanSlot {
  trainingsPlanId: number;
  microNumber: number;
  trainingInMicroNumber: number;
}

export interface PlanTrainingFromAiAction {
  type: 'PLAN_TRAINING_FROM_AI';
  slot: AiPlanSlot;
  baseTraining: Training;
  exercises: AiPlanExercise[];
}

/**
 * GH-544: the AI result planned like a suggestion — same SUGGEST_TRAINING action, but the
 * exercises and their sets are taken exactly as returned (order, swaps, set count).
 */
export function buildAiPlanAction(
  slot: AiPlanSlot,
  baseTraining: Training,
  exercises: AiPlanExercise[],
  nextTrainingsId: number,
  nextWorkoutId: number,
) {
  const workoutIdWorkoutMap = new Map(
    exercises.map(
      ({exerciseId, sets}, position) => [nextWorkoutId + position, {exerciseId, sets} satisfies Workout] as [number, Workout],
    ),
  );
  return {
    type: 'SUGGEST_TRAINING',
    ...slot,
    nextTrainingsId,
    lastTrainingInMicro: baseTraining,
    exercises: exercises.map(exercise => exercise.exerciseId),
    workoutIdWorkoutMap,
  };
}

/**
 * PLAN_TRAINING_FROM_AI is dispatched after a slow AI request. Its training and workout ids are
 * allocated here, from the state the action is reduced against, so a training or workout created
 * while the request was pending is never overwritten. Every other action passes through unchanged.
 */
export function resolvePlanTrainingFromAi(state: GlobalState | undefined, action: AnyAction): AnyAction {
  if (action.type !== 'PLAN_TRAINING_FROM_AI' || state === undefined) return action;
  const {slot, baseTraining, exercises} = action as AnyAction & PlanTrainingFromAiAction;
  return buildAiPlanAction(slot, baseTraining, exercises, determineNewId(state.trainings), determineNewWorkoutId(state.workouts));
}
