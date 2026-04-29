import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Training} from '../../../models/entities/Training';
import {Muscles} from '../../../models/Muscles';
import {getMicroFromTrainingInMicroIndex, trainingInMicroIndex} from '../trainingsPlanReducer';
import {
  MuscleInvolvementData,
  MuscleMapCompare,
  MuscleMapMetric,
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
}

const collectPlannedExerciseWorkouts = (state: GlobalState, training: Training | undefined) => {
  if (!training) return [];
  return (training.exercises ?? []).map((exerciseId) => ({
    exercise: state.exercises.byId[exerciseId],
    workout: training.plannedWorkouts?.[exerciseId] !== undefined ? state.workouts.byId[training.plannedWorkouts[exerciseId]] : undefined,
  }));
};

/**
 * Sum planned-workout muscle aggregates across every training assigned to the given
 * micro. Both compare modes ('last_plan' for previousMicro, 'current_total_plan' for
 * currentMicro) reference planned data only — never completed/done.
 */
const aggregatePlannedAcrossMicro = (state: GlobalState, plan: GlobalState['trainingsPlan']['byId'][number] | undefined, targetMicro: number, metric: MuscleMapMetric): Map<Muscles, number> => {
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

export const computeMuscleInvolvement = (state: GlobalState, args: SelectArgs): MuscleInvolvementData => {
  const {trainingsPlanId, micro, trainingInMicro, metric, compare} = args;
  const plan = state.trainingsPlan.byId[trainingsPlanId];
  const trainingId = plan?.trainings?.[trainingInMicroIndex(micro, trainingInMicro)];
  const training = trainingId !== undefined ? state.trainings.byId[trainingId] : undefined;

  const todayTotals = accumulateForTraining(collectPlannedExerciseWorkouts(state, training), metric);

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
  }

  if (referenceUnavailable) {
    const rows = buildRows(todayTotals, new Map());
    return {rows, globalMax: computeGlobalMax(rows), referenceUnavailable: true, effectiveCompare: 'none'};
  }

  const rows = buildRows(todayTotals, referenceTotals);
  return {rows, globalMax: computeGlobalMax(rows), referenceUnavailable: false, effectiveCompare: compare};
};

export const useMuscleInvolvement = (args: SelectArgs): MuscleInvolvementData => useSelector((state: GlobalState) => computeMuscleInvolvement(state, args));
