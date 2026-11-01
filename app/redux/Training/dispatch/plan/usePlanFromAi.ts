import {useCallback, useMemo} from 'react';
import {useDispatch} from 'react-redux';
import {useLastTrainingInMicro} from '../../use/useLastTrainingInMicro';
import {useWorkoutsByIds} from '../../../Workout/use/useWorkoutsByIds';
import {AiPlanBaseExercise, buildAiPlanBase} from '../../../../utils/ai/planTraining/aiPlanContext';
import {AiPlanExercise} from '../../../../utils/ai/planTraining/aiPlanResult';
import {PlanTrainingFromAiAction} from '../../../fullstateactions/planTrainingFromAi';

/** The base training of "Suggest based on last Training" and a planner for the AI result. */
export const usePlanFromAi = (
  trainingsPlanId: number,
  trainingsNumber: number,
  microNumber: number,
): {base: AiPlanBaseExercise[]; planTraining: (exercises: AiPlanExercise[]) => void} => {
  const dispatch = useDispatch();
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
      // The caller runs this after an AI request that can take a while. The ids are allocated by
      // the root reducer when the action is reduced (see planTrainingFromAi.ts), not from the
      // render that started the request: a workout or training created in the meantime would
      // otherwise be overwritten by this one.
      dispatch({
        type: 'PLAN_TRAINING_FROM_AI',
        slot: {trainingsPlanId, microNumber, trainingInMicroNumber: trainingsNumber},
        baseTraining: lastTrainingInMicro,
        exercises,
      } satisfies PlanTrainingFromAiAction);
    },
    [dispatch, lastTrainingInMicro, microNumber, trainingsNumber, trainingsPlanId],
  );
  return {base, planTraining};
};
