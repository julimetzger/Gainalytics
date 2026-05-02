import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {getMicroFromTrainingInMicroIndex, getTrainingFromTrainingInMicroIndex} from '../../Training/trainingsPlanReducer';

export interface TrainingMetadataByWorkout {
  trainingsId?: number;
  trainingsPlanId?: number;
  trainingName?: string;
  trainingInMicro?: number;
  micro?: number;
  start?: Date;
  end?: Date;
}

export function selectTrainingMetadataByWorkoutId(state: GlobalState, workoutId?: number): TrainingMetadataByWorkout | undefined {
  if (workoutId === undefined) {
    return undefined;
  }

  const workout = state.workouts.byId[workoutId];
  const trainingsId = workout?.trainingsId;
  if (trainingsId === undefined) {
    return undefined;
  }

  const training = state.trainings.byId[trainingsId];
  let matchedPlanId: number | undefined;
  let matchedTrainingKey: string | undefined;

  state.trainingsPlan.allIds.some((planId) => {
    const plan = state.trainingsPlan.byId[planId];
    const entry = Object.entries(plan?.trainings ?? {}).find(([, trainingId]) => trainingId === trainingsId);
    if (!entry) {
      return false;
    }
    matchedPlanId = planId;
    matchedTrainingKey = entry[0];
    return true;
  });

  if (matchedPlanId === undefined || matchedTrainingKey === undefined) {
    return {
      trainingsId,
      start: training?.start,
      end: training?.end,
    };
  }

  const trainingsPlan = state.trainingsPlan.byId[matchedPlanId];
  const trainingInMicro = getTrainingFromTrainingInMicroIndex(matchedTrainingKey);
  const micro = getMicroFromTrainingInMicroIndex(matchedTrainingKey);

  return {
    trainingsId,
    trainingsPlanId: matchedPlanId,
    trainingName: trainingsPlan?.trainingNames?.[trainingInMicro] ?? `Training ${trainingInMicro}`,
    trainingInMicro,
    micro,
    start: training?.start,
    end: training?.end,
  };
}

export const useTrainingMetadataByWorkoutId = (workoutId?: number) => useSelector((state: GlobalState) => selectTrainingMetadataByWorkoutId(state, workoutId));
