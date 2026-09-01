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
  | 'last_training_done';
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
