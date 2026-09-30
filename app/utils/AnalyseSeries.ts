import {LineValue} from 'react-native-charts-wrapper';
import {groupBy, max, sumBy} from 'lodash';
import {Accumulation} from '../components/picker/elements/TrainingElementPicker';
import {Metric} from '../models/Metric';
import {Workout} from '../models/entities/Workout';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {repetitionMax} from './AnalyseUtils';
import {handleAccumulationModeBatching} from './HandleAccumulationModeBatching';
import {evaluationReps, evaluationWeight} from './planRange';

/**
 * GH-468: the Analyse graph combines the sets of one period (and of every
 * included exercise) the way each metric needs it:
 *  - Volume, Reps, Sets      -> sum
 *  - 1RM, Max Intensity      -> maximum
 *  - Average Intensity       -> mean over all included sets
 *  - Frequency               -> number of distinct training days
 */

const localDayKey = (date: Date | string | number) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Intensity of every set relative to the best 1RM of the SAME exercise in the
 * period — a set of one lift must never be measured against another lift's 1RM.
 */
const intensities = (workouts: Workout[]): number[] =>
  Object.values(groupBy(workouts, (workout) => workout.exerciseId)).flatMap((exerciseWorkouts) => {
    const sets = exerciseWorkouts.flatMap((workout) => workout.sets);
    const oneRm = repetitionMax(...sets);
    return sets.map((set: WorkoutSet) => (oneRm ? (evaluationWeight(set) / oneRm) * 100 : 100));
  });

export function aggregateMetric(workouts: Workout[], metric: Metric): number {
  const sets = workouts.flatMap((workout) => workout.sets);
  switch (metric) {
    case Metric.VOLUME:
      return sumBy(sets, (set) => evaluationWeight(set) * evaluationReps(set));
    case Metric.REPS:
      return sumBy(sets, (set) => evaluationReps(set));
    case Metric.SETS:
      return sets.length;
    case Metric.ONE_RM:
      return repetitionMax(...sets);
    case Metric.MAX_INTENSITY:
      return max(intensities(workouts)) ?? 0;
    case Metric.AVERAGE_INTENSITY: {
      const values = intensities(workouts);
      return values.length > 0 ? sum(values) / values.length : 0;
    }
    case Metric.FREQUENCY:
      return new Set(workouts.filter((workout) => workout.sets.length > 0 && workout.start).map((workout) => localDayKey(workout.start!!))).size;
  }
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** One point per accumulation period, oldest first. `id` lists the workouts behind the point. */
export function buildMetricSeries(workouts: Workout[], metric: Metric, accumulation?: Accumulation): LineValue[] {
  const withSets = workouts.filter((workout) => workout.sets.length > 0);
  const buckets = withSets.reduce(handleAccumulationModeBatching(withSets, accumulation), new Map<string, Workout[]>());
  return Array.from(buckets)
    .map(([bucketStart, bucketWorkouts]) => {
      const value = aggregateMetric(bucketWorkouts, metric);
      return {
        id: bucketWorkouts.reduce((acc: string, workout: Workout) => acc + ',' + workout.id!!, ''),
        x: new Date(bucketStart).getTime(),
        y: value,
        marker: value.toFixed(2),
      } as LineValue;
    })
    .sort((a, b) => a.x!! - b.x!!);
}
