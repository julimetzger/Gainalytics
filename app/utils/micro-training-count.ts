import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {Training} from '../models/entities/Training';
import {getMicroFromTrainingInMicroIndex} from '../redux/Training/trainingsPlanReducer';

/**
 * GH-644 — the "done / total" trainings counter of one micro. Home (hero ring and
 * plan row) and the micro Overview "vs Plan" read it from here, so the two cannot
 * diverge again: the overview used to count only the trainings with planned sets.
 */
export interface MicroTrainingCount {
  /** Trainings of the micro that have ended. */
  done: number;
  /** The plan's training types, or — without any — the micro's slots. */
  total: number;
  /** `total - done`, never negative. */
  open: number;
  /** Open trainings that have no planned sets yet (including never created ones). */
  notPlanned: number;
}

export const hasPlannedSets = (training: Training | undefined): boolean => Object.keys(training?.plannedWorkouts ?? {}).length > 0;

export const countMicroTrainings = (plan: TrainingsPlan, micro: number, trainingsById: {[id: number]: Training | undefined}): MicroTrainingCount => {
  const trainings = Object.entries(plan.trainings ?? {})
    .filter(([key]) => getMicroFromTrainingInMicroIndex(key) === micro)
    .map(([, trainingId]) => trainingsById[trainingId]);
  const done = trainings.filter((training) => training?.end).length;
  const trainingTypeCount = Object.keys(plan.trainingNames ?? {}).length;
  const total = trainingTypeCount > 0 ? trainingTypeCount : trainings.length;
  const open = Math.max(0, total - done);
  const plannedOpen = trainings.filter((training) => training !== undefined && !training.end && hasPlannedSets(training)).length;
  return {done, total, open, notPlanned: Math.max(0, open - plannedOpen)};
};
