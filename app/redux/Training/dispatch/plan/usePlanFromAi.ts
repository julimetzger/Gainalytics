import {useCallback, useMemo} from 'react';
import {Action} from 'redux';
import {useDispatch, useStore} from 'react-redux';
import {GlobalState} from '../../../rootReducer';
import {determineNewId} from '../../../normalizedState';
import {determineNewWorkoutId} from '../../../normalizedWorkoutState';
import {useLastTrainingInMicro} from '../../use/useLastTrainingInMicro';
import {useWorkoutsByIds} from '../../../Workout/use/useWorkoutsByIds';
import {Training} from '../../../../models/entities/Training';
import {Workout} from '../../../../models/entities/Workout';
import {AiPlanBaseExercise, buildAiPlanBase} from '../../../../utils/ai/planTraining/aiPlanContext';
import {AiPlanExercise} from '../../../../utils/ai/planTraining/aiPlanResult';

interface AiPlanSlot {
  trainingsPlanId: number;
  microNumber: number;
  trainingInMicroNumber: number;
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

/** The base training of "Suggest based on last Training" and a planner for the AI result. */
export const usePlanFromAi = (
  trainingsPlanId: number,
  trainingsNumber: number,
  microNumber: number,
): {base: AiPlanBaseExercise[]; planTraining: (exercises: AiPlanExercise[]) => void} => {
  const dispatch = useDispatch();
  const store = useStore<GlobalState>();
  const lastTrainingInMicro = useLastTrainingInMicro(trainingsPlanId, trainingsNumber, microNumber);
  const workoutIds = lastTrainingInMicro
    ? [...Object.values(lastTrainingInMicro.doneWorkoutIds ?? {}), ...Object.values(lastTrainingInMicro.plannedWorkouts ?? {})]
    : [];
  const workouts = useWorkoutsByIds(workoutIds);
  const base = useMemo(
    () => buildAiPlanBase(lastTrainingInMicro, Object.fromEntries(workouts.map(workout => [workout.id, workout]))),
    [lastTrainingInMicro, workouts],
  );
  const planTraining = useCallback(
    (exercises: AiPlanExercise[]) => {
      if (lastTrainingInMicro === undefined) return;
      // The caller runs this after an AI request that can take a while. Allocate the ids from the
      // store NOW, not from the render that started the request: a workout or training created in
      // the meantime would otherwise be overwritten by this one.
      const state = store.getState();
      dispatch(
        buildAiPlanAction(
          {trainingsPlanId, microNumber, trainingInMicroNumber: trainingsNumber},
          lastTrainingInMicro,
          exercises,
          determineNewId(state.trainings),
          determineNewWorkoutId(state.workouts),
        ) as Action,
      );
    },
    [dispatch, lastTrainingInMicro, microNumber, store, trainingsNumber, trainingsPlanId],
  );
  return {base, planTraining};
};
