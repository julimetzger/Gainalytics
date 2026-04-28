import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Training} from '../../../models/entities/Training';
import {TrainingsState} from '../../../models/TrainingsState';
import {trainingInMicroIndex, getMicroFromTrainingInMicroIndex, getTrainingFromTrainingInMicroIndex} from '../trainingsPlanReducer';
import {
  MuscleInvolvementData,
  MuscleMapCompare,
  MuscleMapMetric,
  accumulateForTraining,
  buildRows,
  computeGlobalMax,
} from '../../../utils/MuscleInvolvementUtils';

const LAST_TRAINING_LOOKBACK_DAYS = 21;

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

const collectDoneExerciseWorkouts = (state: GlobalState, training: Training | undefined) => {
  if (!training) return [];
  return (training.exercises ?? []).map((exerciseId) => ({
    exercise: state.exercises.byId[exerciseId],
    workout: training.doneWorkoutIds?.[exerciseId] !== undefined ? state.workouts.byId[training.doneWorkoutIds[exerciseId]] : undefined,
  }));
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

  let referenceTotals = new Map<ReturnType<typeof Object.values> extends never ? never : any, number>();
  let referenceUnavailable = false;

  if (compare === 'micro') {
    // Sum planned sets across the entire current micro (all trainingInMicro slots).
    const trainingsMap = plan?.trainings ?? {};
    const trainingIdsInMicro = Object.entries(trainingsMap)
      .filter(([key]) => getMicroFromTrainingInMicroIndex(key) === micro)
      .map(([, id]) => id);
    if (trainingIdsInMicro.length === 0) {
      referenceUnavailable = true;
    } else {
      const acc = new Map();
      for (const id of trainingIdsInMicro) {
        const t = state.trainings.byId[id];
        const exerciseWorkouts = collectPlannedExerciseWorkouts(state, t);
        const partial = accumulateForTraining(exerciseWorkouts, metric);
        for (const [muscle, value] of partial.entries()) {
          acc.set(muscle, (acc.get(muscle) ?? 0) + value);
        }
      }
      referenceTotals = acc;
      // If reference is empty (no planned sets anywhere in micro) treat as unavailable.
      if (referenceTotals.size === 0) referenceUnavailable = true;
    }
  } else if (compare === 'last') {
    // Find most recent FINISHED training with the same trainingInMicro slot, within last 21 days.
    const trainingsMap = plan?.trainings ?? {};
    const cutoff = Date.now() - LAST_TRAINING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    const candidates = Object.entries(trainingsMap)
      .filter(([key]) => getTrainingFromTrainingInMicroIndex(key) === trainingInMicro && getMicroFromTrainingInMicroIndex(key) !== micro)
      .map(([, id]) => state.trainings.byId[id])
      .filter((t): t is Training => !!t && t.state === TrainingsState.FINISHED && !!t.end)
      .filter((t) => new Date(t.end!).getTime() >= cutoff)
      .sort((a, b) => new Date(b.end!).getTime() - new Date(a.end!).getTime());

    const last = candidates[0];
    if (!last) {
      referenceUnavailable = true;
    } else {
      // Reference uses DONE workouts (actual completed performance).
      referenceTotals = accumulateForTraining(collectDoneExerciseWorkouts(state, last), metric);
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
