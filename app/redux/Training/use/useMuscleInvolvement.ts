import {useSelector} from 'react-redux';
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
 * What the micro-wide planned muscle map is compared against (GH-436):
 * - 'done'      — what was actually trained in the same micro (default; the
 *                 Overview's Plan position puts plan and reality side by side)
 * - 'last_plan' — the previous micro's plan (the GH-417 comparison)
 * - 'none'      — no reference layer
 */
export type MicroPlanCompare = 'done' | 'last_plan' | 'none';

/**
 * GH-417 — the same muscle map, but for a whole micro's PLANNED load instead of a
 * single training's. Subject is the existing micro aggregation
 * (`aggregatePlannedAcrossMicro`, also what the 'current_total_plan' /
 * 'last_plan' compares use). GH-436 moved this map into the Overview and made
 * the reference selectable, defaulting to the micro's DONE load.
 */
export const computeMicroPlannedMuscleInvolvement = (
  state: GlobalState,
  trainingsPlanId: number,
  micro: number,
  metric: MuscleMapMetric,
  compare: MicroPlanCompare = 'done',
): MuscleInvolvementData => {
  const plan = state.trainingsPlan.byId[trainingsPlanId];
  const todayTotals = aggregatePlannedAcrossMicro(state, plan, micro, metric);

  if (compare === 'none') {
    const rows = buildRows(todayTotals, new Map<Muscles, number>());
    return {rows, globalMax: computeGlobalMax(rows), referenceUnavailable: false, effectiveCompare: 'none'};
  }

  let referenceTotals = new Map<Muscles, number>();
  if (compare === 'done') {
    referenceTotals = aggregateDoneAcrossMicro(state, plan, micro, metric);
  } else {
    const previousMicro = micro - 1;
    referenceTotals = previousMicro >= 1 ? aggregatePlannedAcrossMicro(state, plan, previousMicro, metric) : new Map<Muscles, number>();
  }
  const referenceUnavailable = referenceTotals.size === 0;

  const rows = buildRows(todayTotals, referenceUnavailable ? new Map<Muscles, number>() : referenceTotals);
  return {
    rows,
    globalMax: computeGlobalMax(rows),
    referenceUnavailable,
    // 'done' has no MuscleMapCompare twin; callers key their labels on the
    // requested compare, this field only says whether a reference layer exists.
    effectiveCompare: referenceUnavailable ? 'none' : compare === 'done' ? 'last_training_done' : 'last_plan',
  };
};

export const useMicroPlannedMuscleInvolvement = (trainingsPlanId: number, micro: number, metric: MuscleMapMetric, compare: MicroPlanCompare = 'done'): MuscleInvolvementData =>
  useSelector((state: GlobalState) => computeMicroPlannedMuscleInvolvement(state, trainingsPlanId, micro, metric, compare));

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
