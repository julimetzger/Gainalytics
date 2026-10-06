import {Training} from '../models/entities/Training';
import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {TrainingsState} from '../models/TrainingsState';

/**
 * GH-442: the most recently planned training of a plan is the one created last.
 * Training ids are handed out ascending (determineNewId), so it is the plan's
 * highest training id — independent of which micro/day slot it sits in.
 */
export function lastPlannedTrainingId(trainingsPlan: TrainingsPlan | undefined): number | undefined {
  const ids = Object.values(trainingsPlan?.trainings ?? {}).filter((id) => Number.isFinite(id));
  return ids.length > 0 ? Math.max(...ids) : undefined;
}

/**
 * GH-442: "Clear planned training" is only offered for the plan's most recently
 * planned training, only while it is still PLANNED (not started or finished),
 * and only if there is something planned to clear.
 */
export function canClearPlannedTraining(trainingsPlan: TrainingsPlan | undefined, training: Training | undefined): boolean {
  if (training?.id === undefined || training.state !== TrainingsState.PLANNED) return false;
  if ((training.exercises?.length ?? 0) === 0 && Object.keys(training.plannedWorkouts ?? {}).length === 0) return false;
  return lastPlannedTrainingId(trainingsPlan) === training.id;
}
