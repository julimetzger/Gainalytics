import {Muscles} from '../models/Muscles';
import {Exercise} from '../models/entities/Exercise';
import {Workout} from '../models/entities/Workout';
import {evaluationReps, evaluationWeight} from './planRange';

export type MuscleMapMetric = 'sets' | 'volume';
export type MuscleMapCompare =
  | 'none'
  | 'last_plan'
  | 'current_total_plan'
  | 'last_training_plan'
  | 'last_training_done'
  // GH-444: what THIS training was planned to be — the reference is the planned
  // workouts of the very same training the analysis is showing.
  | 'this_training_plan';
export type MuscleMapView = 'plan' | 'analyse';

export interface MuscleInvolvementRow {
  muscleGroupId: Muscles;
  label: string;
  today: number;
  reference: number;
}

export interface MuscleInvolvementData {
  rows: MuscleInvolvementRow[];
  globalMax: number;
  /** True when compare !== 'none' was requested but no reference data was available. */
  referenceUnavailable: boolean;
  /** Effective compare mode after fallback. */
  effectiveCompare: MuscleMapCompare;
}

const MUSCLE_LABELS: Record<Muscles, string> = {
  [Muscles.BACK]: 'Back',
  [Muscles.BICEPS]: 'Biceps',
  [Muscles.CHEST]: 'Chest',
  [Muscles.CORE]: 'Core',
  [Muscles.GLUTES]: 'Glutes',
  [Muscles.HAMSTRINGS]: 'Hamstrings',
  [Muscles.QUADS]: 'Quads',
  [Muscles.SHOULDERS]: 'Shoulders',
  [Muscles.TRICEPS]: 'Triceps',
};

export const muscleLabel = (muscle: Muscles): string => MUSCLE_LABELS[muscle] ?? String(muscle);

/**
 * Sum the contribution of one set of (exercise, sets) to each muscle, weighted by
 * the exercise's muscle-percent taxonomy. Mirrors the convention in AnalyseUtils.ts:
 * sets/volume contribute proportional to muscles[].percent (so a 50% pair adds 0.5×).
 */
export const accumulateForExercise = (
  acc: Map<Muscles, number>,
  exercise: Exercise | undefined,
  workout: Workout | undefined,
  metric: MuscleMapMetric,
): void => {
  if (!exercise?.muscles || !workout?.sets) return;
  for (const pair of exercise.muscles) {
    if (!pair.muscle) continue;
    const factor = (pair.percent ?? 0) / 100;
    if (factor <= 0) continue;
    let contribution = 0;
    if (metric === 'sets') {
      contribution = workout.sets.length * factor;
    } else {
      // tonnes: reps * weight_kg / 1000, weighted by muscle factor.
      // GH-63: a planned range counts with its lower bound (see planRange).
      for (const set of workout.sets) {
        contribution += (evaluationReps(set) * evaluationWeight(set) * factor) / 1000;
      }
    }
    acc.set(pair.muscle, (acc.get(pair.muscle) ?? 0) + contribution);
  }
};

/** Sum planned-workout muscle contributions across one or more (exercise, plannedWorkout) pairs. */
export const accumulateForTraining = (
  exerciseWorkouts: Array<{exercise: Exercise | undefined; workout: Workout | undefined}>,
  metric: MuscleMapMetric,
): Map<Muscles, number> => {
  const acc = new Map<Muscles, number>();
  for (const {exercise, workout} of exerciseWorkouts) {
    accumulateForExercise(acc, exercise, workout, metric);
  }
  return acc;
};

/**
 * Combine today's totals with reference totals into rows sorted by today (desc).
 * Includes any muscle that today has activity for. Reference-only muscles are
 * ignored — the rows track muscles involved in today's training.
 */
export const buildRows = (
  todayTotals: Map<Muscles, number>,
  referenceTotals: Map<Muscles, number>,
): MuscleInvolvementRow[] => {
  const rows: MuscleInvolvementRow[] = [];
  for (const [muscle, today] of todayTotals.entries()) {
    if (today <= 0) continue;
    rows.push({
      muscleGroupId: muscle,
      label: muscleLabel(muscle),
      today,
      reference: referenceTotals.get(muscle) ?? 0,
    });
  }
  rows.sort((a, b) => b.today - a.today);
  return rows;
};

export const computeGlobalMax = (rows: MuscleInvolvementRow[]): number => {
  let max = 0;
  for (const row of rows) {
    if (row.today > max) max = row.today;
    if (row.reference > max) max = row.reference;
  }
  return max;
};

/** Round a metric value for display. Sets → integer; volume → 1 decimal tonnes. */
export const formatMetricValue = (value: number, metric: MuscleMapMetric): string => {
  if (metric === 'sets') {
    // Show fractional sets to one decimal when the contribution is partial
    // (e.g. a secondary muscle at 50% gets 1.5 from 3 sets), else as int.
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) return String(rounded);
    return rounded.toFixed(1);
  }
  return `${(Math.round(value * 10) / 10).toFixed(1)}t`;
};

/**
 * GH-526 — muscle totals straight from a list of workouts. The muscle map and
 * the Muscle Overview table below it are fed from the same workout lists, so
 * both always compare against the same reference.
 */
export const aggregateWorkouts = (
  workouts: Workout[],
  exercisesById: {[id: number]: Exercise | undefined},
  metric: MuscleMapMetric,
): Map<Muscles, number> => {
  const acc = new Map<Muscles, number>();
  for (const workout of workouts) {
    accumulateForExercise(acc, exercisesById[workout.exerciseId], workout, metric);
  }
  return acc;
};

/** The four values a tapped muscle expands to (GH-526): plan / done of the reference period and of this one. */
export interface MuscleMapDetail {
  planPrev?: number;
  planCur?: number;
  donePrev?: number;
  doneCur?: number;
}

export interface MuscleMapDetailSources {
  planPrev?: Map<Muscles, number>;
  planCur?: Map<Muscles, number>;
  donePrev?: Map<Muscles, number>;
  doneCur?: Map<Muscles, number>;
}

export interface MuscleCompareRow {
  muscleGroupId: Muscles;
  label: string;
  value: number;
  reference: number;
  detail: MuscleMapDetail;
}

/**
 * GH-526 — rows of the comparison muscle map. Unlike `buildRows` a muscle that
 * only the reference carries is kept (a planned muscle that was never trained is
 * the biggest shortfall of all) unless `subjectOnly` is set — the share view
 * only lists what the subject itself trains. Sorted by value, biggest first.
 */
export const buildCompareRows = (
  subject: Map<Muscles, number>,
  reference: Map<Muscles, number> | undefined,
  details: MuscleMapDetailSources = {},
  subjectOnly = false,
): MuscleCompareRow[] => {
  const muscles = new Set<Muscles>([...subject.keys(), ...(reference && !subjectOnly ? reference.keys() : [])]);
  const rows: MuscleCompareRow[] = [];
  for (const muscle of muscles) {
    const value = subject.get(muscle) ?? 0;
    const ref = reference?.get(muscle) ?? 0;
    if (value <= 0 && ref <= 0) continue;
    if (subjectOnly && value <= 0) continue;
    const pick = (source?: Map<Muscles, number>) => (source ? source.get(muscle) ?? 0 : undefined);
    rows.push({
      muscleGroupId: muscle,
      label: muscleLabel(muscle),
      value,
      reference: ref,
      detail: {planPrev: pick(details.planPrev), planCur: pick(details.planCur), donePrev: pick(details.donePrev), doneCur: pick(details.doneCur)},
    });
  }
  rows.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  return rows;
};

/** GH-526 Diff readout: only the signed delta — `+2`, `−1.5`, `±0`, volume with its `t`. */
export const formatMetricDiff = (difference: number, metric: MuscleMapMetric): string => {
  const rounded = Math.round(difference * 10) / 10;
  if (rounded === 0) return '±0';
  const magnitude = formatMetricValue(Math.abs(rounded), metric);
  return `${rounded > 0 ? '+' : '−'}${magnitude}`;
};

/** GH-526 Share readout: the subject as a whole-number percentage of the reference. */
export const formatShare = (value: number, reference: number): string => (reference > 0 ? `${Math.round((value / reference) * 100)}%` : '–');
