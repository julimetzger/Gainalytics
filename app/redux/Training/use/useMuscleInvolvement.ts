import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Training} from '../../../models/entities/Training';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Muscles} from '../../../models/Muscles';
import {
  getMicroFromTrainingInMicroIndex,
  getMesoForMicro,
  getSortedMesos,
  getTrainingFromTrainingInMicroIndex,
  trainingInMicroIndex,
} from '../trainingsPlanReducer';
import {
  MuscleInvolvementData,
  MuscleMapCompare,
  MuscleMapMetric,
  MuscleMapView,
  accumulateForTraining,
  buildRows,
  computeGlobalMax,
} from '../../../utils/MuscleInvolvementUtils';

interface SelectArgs {
  trainingsPlanId: number;
  micro: number;
  trainingInMicro: number;
  metric: MuscleMapMetric;
  compare: MuscleMapCompare;
  /** Which workouts the "today" subject should be built from. Defaults to 'plan'. */
  view?: MuscleMapView;
}

const collectPlannedExerciseWorkouts = (state: GlobalState, training: Training | undefined) => {
  if (!training) return [];
  return (training.exercises ?? []).map((exerciseId) => ({
    exercise: state.exercises.byId[exerciseId],
    workout: training.plannedWorkouts?.[exerciseId] !== undefined ? state.workouts.byId[training.plannedWorkouts[exerciseId]] : undefined,
  }));
};

const collectDoneExerciseWorkouts = (state: GlobalState, training: Training | undefined) => {
  if (!training) return [];
  return (training.exercises ?? []).map((exerciseId) => ({
    exercise: state.exercises.byId[exerciseId],
    workout: training.doneWorkoutIds?.[exerciseId] !== undefined ? state.workouts.byId[training.doneWorkoutIds[exerciseId]] : undefined,
  }));
};

/**
 * Sum planned-workout muscle aggregates across every training assigned to the given
 * micro. Both compare modes ('last_plan' for previousMicro, 'current_total_plan' for
 * currentMicro) reference planned data only — never completed/done.
 */
export const aggregatePlannedAcrossMicro = (state: GlobalState, plan: GlobalState['trainingsPlan']['byId'][number] | undefined, targetMicro: number, metric: MuscleMapMetric): Map<Muscles, number> => {
  const acc = new Map<Muscles, number>();
  const trainingsMap = plan?.trainings ?? {};
  const trainingIdsInMicro = Object.entries(trainingsMap)
    .filter(([key]) => getMicroFromTrainingInMicroIndex(key) === targetMicro)
    .map(([, id]) => id);
  for (const id of trainingIdsInMicro) {
    const t = state.trainings.byId[id];
    if (!t) continue;
    const partial = accumulateForTraining(collectPlannedExerciseWorkouts(state, t), metric);
    for (const [muscle, value] of partial.entries()) {
      acc.set(muscle, (acc.get(muscle) ?? 0) + value);
    }
  }
  return acc;
};

/**
 * Find the most-recent training (by micro) sharing the same training-in-micro position
 * as the current training. Prefers the same Meso, falling back to the immediately
 * preceding Meso. When `requireDone` is true, only trainings with `end !== undefined`
 * are considered.
 *
 * Returns both the training and its micro number — the micro is needed for picker labels.
 */
export interface LastMatchingTraining {
  training: Training;
  micro: number;
}

export const findLastMatchingTraining = (
  state: GlobalState,
  plan: TrainingsPlan | undefined,
  trainingInMicro: number,
  currentMicro: number,
  requireDone: boolean,
  /** GH-526: further condition on a candidate, e.g. "has planned workouts". */
  accept?: (training: Training) => boolean,
): LastMatchingTraining | undefined => {
  if (!plan) return undefined;
  const trainings = plan.trainings ?? {};
  const mesos = plan.mesos;

  // Collect entries at the same trainingInMicro position, in micros earlier than current,
  // sorted by micro descending so we naturally take the most-recent match first.
  const candidates = Object.entries(trainings)
    .filter(([key]) => getTrainingFromTrainingInMicroIndex(key) === trainingInMicro)
    .map(([key, id]) => [getMicroFromTrainingInMicroIndex(key), id] as [number, number])
    .filter(([micro]) => micro < currentMicro)
    .sort((a, b) => b[0] - a[0]);

  const passesDoneFilter = (training: Training | undefined): training is Training => {
    if (!training) return false;
    if (requireDone && !training.end) return false;
    if (accept && !accept(training)) return false;
    return true;
  };

  const currentMeso = getMesoForMicro(mesos, currentMicro);

  // Same meso first
  for (const [micro, id] of candidates) {
    if (currentMeso && micro < currentMeso.startMicro) continue;
    const training = state.trainings.byId[id];
    if (!passesDoneFilter(training)) continue;
    return {training, micro};
  }

  // Previous meso only (do not fall further back)
  const sorted = getSortedMesos(mesos);
  const currentMesoIdx = currentMeso ? sorted.findIndex((m) => m.id === currentMeso.id) : -1;
  if (currentMesoIdx <= 0) return undefined;
  const previousMeso = sorted[currentMesoIdx - 1];
  const previousMesoEnd = currentMeso!.startMicro - 1;

  for (const [micro, id] of candidates) {
    if (micro < previousMeso.startMicro || micro > previousMesoEnd) continue;
    const training = state.trainings.byId[id];
    if (!passesDoneFilter(training)) continue;
    return {training, micro};
  }

  return undefined;
};

/**
 * A reference layer is only meaningful when at least one muscle carries load.
 * A planned workout can exist and still aggregate to nothing — e.g. its exercise
 * has no muscle taxonomy, or a planned set has weight 0 under the volume metric.
 */
const hasPositiveValue = (totals: Map<Muscles, number>): boolean => {
  for (const value of totals.values()) {
    if (value > 0) return true;
  }
  return false;
};

const aggregateTraining = (
  state: GlobalState,
  training: Training | undefined,
  metric: MuscleMapMetric,
  fromDone: boolean,
): Map<Muscles, number> => {
  if (!training) return new Map();
  const pairs = fromDone
    ? collectDoneExerciseWorkouts(state, training)
    : collectPlannedExerciseWorkouts(state, training);
  return accumulateForTraining(pairs, metric);
};

export const computeMuscleInvolvement = (state: GlobalState, args: SelectArgs): MuscleInvolvementData => {
  const {trainingsPlanId, micro, trainingInMicro, metric, compare} = args;
  const view: MuscleMapView = args.view ?? 'plan';
  const plan = state.trainingsPlan.byId[trainingsPlanId];
  const trainingId = plan?.trainings?.[trainingInMicroIndex(micro, trainingInMicro)];
  const training = trainingId !== undefined ? state.trainings.byId[trainingId] : undefined;

  const todayTotals = aggregateTraining(state, training, metric, view === 'analyse');

  if (compare === 'none') {
    const rows = buildRows(todayTotals, new Map());
    return {rows, globalMax: computeGlobalMax(rows), referenceUnavailable: false, effectiveCompare: 'none'};
  }

  let referenceTotals = new Map<Muscles, number>();
  let referenceUnavailable = false;

  if (compare === 'current_total_plan') {
    referenceTotals = aggregatePlannedAcrossMicro(state, plan, micro, metric);
    if (referenceTotals.size === 0) referenceUnavailable = true;
  } else if (compare === 'last_plan') {
    const previousMicro = micro - 1;
    if (previousMicro < 1) {
      referenceUnavailable = true;
    } else {
      referenceTotals = aggregatePlannedAcrossMicro(state, plan, previousMicro, metric);
      if (referenceTotals.size === 0) referenceUnavailable = true;
    }
  } else if (compare === 'this_training_plan') {
    // GH-444 — the reference is what THIS training was planned to be. No lookup of
    // sibling or previous trainings at all; the subject and the reference are two
    // sides (done / planned) of the same training.
    referenceTotals = aggregateTraining(state, training, metric, false);
    if (!hasPositiveValue(referenceTotals)) referenceUnavailable = true;
  } else if (compare === 'last_training_plan' || compare === 'last_training_done') {
    const requireDone = compare === 'last_training_done';
    const match = findLastMatchingTraining(state, plan, trainingInMicro, micro, requireDone);
    if (!match) {
      referenceUnavailable = true;
    } else {
      referenceTotals = aggregateTraining(state, match.training, metric, requireDone);
      if (referenceTotals.size === 0) referenceUnavailable = true;
    }
  }

  if (referenceUnavailable) {
    const rows = buildRows(todayTotals, new Map());
    return {rows, globalMax: computeGlobalMax(rows), referenceUnavailable: true, effectiveCompare: 'none'};
  }

  const rows = buildRows(todayTotals, referenceTotals);
  return {rows, globalMax: computeGlobalMax(rows), referenceUnavailable: false, effectiveCompare: compare};
};

export const useMuscleInvolvement = (args: SelectArgs): MuscleInvolvementData => useSelector((state: GlobalState) => computeMuscleInvolvement(state, args));

/**
 * GH-444 — is there anything to compare against for the 'this_training_plan' mode?
 * True exactly when the planned workouts of this training aggregate to at least one
 * muscle with load, which is the same condition `computeMuscleInvolvement` uses to
 * decide `referenceUnavailable`. The picker keys the option's `disabled` state on
 * this, so a training without planning offers a visibly dead option instead of a
 * reference layer full of zeros.
 */
export const hasThisTrainingPlannedInvolvement = (
  state: GlobalState,
  trainingsPlanId: number,
  micro: number,
  trainingInMicro: number,
  metric: MuscleMapMetric,
): boolean => {
  const plan = state.trainingsPlan.byId[trainingsPlanId];
  const trainingId = plan?.trainings?.[trainingInMicroIndex(micro, trainingInMicro)];
  const training = trainingId !== undefined ? state.trainings.byId[trainingId] : undefined;
  return hasPositiveValue(aggregateTraining(state, training, metric, false));
};

export const useThisTrainingPlannedAvailable = (
  trainingsPlanId: number,
  micro: number,
  trainingInMicro: number,
  metric: MuscleMapMetric,
): boolean => useSelector((state: GlobalState) => hasThisTrainingPlannedInvolvement(state, trainingsPlanId, micro, trainingInMicro, metric));

/**
 * GH-436 — sum DONE-workout muscle aggregates across every training assigned to
 * the given micro. The done-side twin of `aggregatePlannedAcrossMicro`: same
 * walk, same accumulation, only the workout source differs.
 */
export const aggregateDoneAcrossMicro = (state: GlobalState, plan: GlobalState['trainingsPlan']['byId'][number] | undefined, targetMicro: number, metric: MuscleMapMetric): Map<Muscles, number> => {
  const acc = new Map<Muscles, number>();
  const trainingsMap = plan?.trainings ?? {};
  const trainingIdsInMicro = Object.entries(trainingsMap)
    .filter(([key]) => getMicroFromTrainingInMicroIndex(key) === targetMicro)
    .map(([, id]) => id);
  for (const id of trainingIdsInMicro) {
    const t = state.trainings.byId[id];
    if (!t) continue;
    const partial = accumulateForTraining(collectDoneExerciseWorkouts(state, t), metric);
    for (const [muscle, value] of partial.entries()) {
      acc.set(muscle, (acc.get(muscle) ?? 0) + value);
    }
  }
  return acc;
};

/**
 * Selector hook returning the micro number of the most-recent training that shares the
 * current trainingInMicro position. Returns `undefined` when no such training exists.
 * Used by the picker UI to render labels like "Micro 3 · Push" and to decide whether
 * the `last_training_done` option should appear at all.
 */
export const useLastMatchingTrainingMicro = (
  trainingsPlanId: number,
  trainingInMicro: number,
  currentMicro: number,
  requireDone: boolean,
): number | undefined =>
  useSelector((state: GlobalState) => {
    const plan = state.trainingsPlan.byId[trainingsPlanId];
    const match = findLastMatchingTraining(state, plan, trainingInMicro, currentMicro, requireDone);
    return match?.micro;
  });

const hasWorkouts = (workouts: {[exerciseId: number]: number} | undefined) => Object.keys(workouts ?? {}).length > 0;

/**
 * GH-526 — the last matching training as the training analysis compares
 * against it: for the plan, the last one at this position that was planned;
 * for the done side, the last one that was trained. It may come from an
 * earlier micro or from the previous meso, hence the micro in the result.
 */
export const useLastMatchingTraining = (trainingsPlanId: number, trainingInMicro: number, currentMicro: number, side: 'plan' | 'done'): LastMatchingTraining | undefined =>
  useSelector((state: GlobalState) => {
    const plan = state.trainingsPlan.byId[trainingsPlanId];
    return side === 'done'
      ? findLastMatchingTraining(state, plan, trainingInMicro, currentMicro, true, (training) => hasWorkouts(training.doneWorkoutIds))
      : findLastMatchingTraining(state, plan, trainingInMicro, currentMicro, false, (training) => hasWorkouts(training.plannedWorkouts));
  }, shallowEqual);
