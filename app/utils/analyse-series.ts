import {LineValue} from 'react-native-charts-wrapper';
import {groupBy, max} from 'lodash';
import {Accumulation} from '../models/Accumulation';
import {Metric} from '../models/Metric';
import {Muscles} from '../models/Muscles';
import {Exercise} from '../models/entities/Exercise';
import {Workout} from '../models/entities/Workout';
import {repetitionMax} from './AnalyseUtils';
import {handleAccumulationModeBatching} from './HandleAccumulationModeBatching';
import {evaluationReps, evaluationWeight} from './planRange';

/**
 * GH-468: the Analyse graph combines the sets of one period (and of every
 * included exercise) the way each metric needs it:
 *  - Volume, Reps, Sets      -> sum, each set weighted by its workout's share
 *  - 1RM, Max Intensity      -> maximum (unweighted: a share does not make a lift lighter)
 *  - Average Intensity       -> mean over all included sets, weighted by share
 *  - Frequency               -> number of distinct training days (a day is trained or not)
 */

/** Share (0..1) with which a workout counts towards the current selection. */
export type WorkoutWeight = (workout: Workout) => number;

export const fullWeight: WorkoutWeight = () => 1;

/**
 * Without a selection every workout counts fully. An explicitly selected
 * exercise counts fully; otherwise the exercise counts with the summed percent
 * of the selected muscles it works (20 % biceps -> 0.2), capped at 1 so an
 * exercise never counts more than once.
 */
export function selectionWeight(selectedExercises: Exercise[], muscles: Muscles[], exercisesForMuscles: Exercise[]): WorkoutWeight {
  if (selectedExercises.length === 0 && muscles.length === 0) {
    return fullWeight;
  }
  const explicitIds = new Set(selectedExercises.map((it) => it.id));
  const muscleShare = new Map(
    exercisesForMuscles.map((exercise) => {
      const percent = (exercise.muscles ?? []).filter((it) => it.muscle && muscles.includes(it.muscle)).reduce((total, it) => total + (it.percent ?? 0), 0);
      return [exercise.id, Math.min(percent / 100, 1)];
    }),
  );
  return (workout) => (explicitIds.has(workout.exerciseId) ? 1 : muscleShare.get(workout.exerciseId) ?? 0);
}

const localDayKey = (date: Date | string | number) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Intensity of every set relative to the best 1RM of the SAME exercise in the
 * period — a set of one lift must never be measured against another lift's 1RM.
 */
const intensities = (workouts: Workout[], weightOf: WorkoutWeight): {value: number; weight: number}[] =>
  Object.values(groupBy(workouts, (workout) => workout.exerciseId)).flatMap((exerciseWorkouts) => {
    const oneRm = repetitionMax(...exerciseWorkouts.flatMap((workout) => workout.sets));
    return exerciseWorkouts.flatMap((workout) =>
      workout.sets.map((set) => ({
        value: oneRm ? (evaluationWeight(set) / oneRm) * 100 : 100,
        weight: weightOf(workout),
      })),
    );
  });

const weightedSum = (workouts: Workout[], weightOf: WorkoutWeight, perSet: (set: Workout['sets'][number]) => number) =>
  workouts.reduce((total, workout) => total + weightOf(workout) * workout.sets.reduce((sets, set) => sets + perSet(set), 0), 0);

export function aggregateMetric(workouts: Workout[], metric: Metric, weightOf: WorkoutWeight = fullWeight): number {
  const included = workouts.filter((workout) => workout.sets.length > 0 && weightOf(workout) > 0);
  switch (metric) {
    case Metric.VOLUME:
      return weightedSum(included, weightOf, (set) => evaluationWeight(set) * evaluationReps(set));
    case Metric.REPS:
      return weightedSum(included, weightOf, (set) => evaluationReps(set));
    case Metric.SETS:
      return weightedSum(included, weightOf, () => 1);
    case Metric.ONE_RM:
      return repetitionMax(...included.flatMap((workout) => workout.sets));
    case Metric.MAX_INTENSITY:
      return max(intensities(included, weightOf).map((it) => it.value)) ?? 0;
    case Metric.AVERAGE_INTENSITY: {
      const values = intensities(included, weightOf);
      const totalWeight = values.reduce((total, it) => total + it.weight, 0);
      return totalWeight > 0 ? values.reduce((total, it) => total + it.value * it.weight, 0) / totalWeight : 0;
    }
    case Metric.FREQUENCY:
      return new Set(included.filter((workout) => workout.start).map((workout) => localDayKey(workout.start!!))).size;
  }
}

/** A chart point; `id` lists the workouts behind it (comma separated) and is read back on tap. */
export type MetricPoint = LineValue & {id: string; x: number; y: number; marker: string};

/** One point per accumulation period, oldest first. */
export function buildMetricSeries(workouts: Workout[], metric: Metric, accumulation?: Accumulation, weightOf: WorkoutWeight = fullWeight): MetricPoint[] {
  const included = workouts.filter((workout) => workout.sets.length > 0 && weightOf(workout) > 0);
  const buckets = included.reduce(handleAccumulationModeBatching(included, accumulation), new Map<string, Workout[]>());
  return Array.from(buckets)
    .map(([bucketStart, bucketWorkouts]): MetricPoint => {
      const value = aggregateMetric(bucketWorkouts, metric, weightOf);
      return {
        id: bucketWorkouts.reduce((acc: string, workout: Workout) => acc + ',' + workout.id!!, ''),
        x: new Date(bucketStart).getTime(),
        y: value,
        marker: value.toFixed(2),
      };
    })
    .sort((a, b) => a.x - b.x);
}
