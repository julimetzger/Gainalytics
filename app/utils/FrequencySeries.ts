import {LineValue} from 'react-native-charts-wrapper';
import {Accumulation} from '../components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../models/AccumulationMode';
import {Metric} from '../models/Metric';
import {Workout} from '../models/entities/Workout';
import {calculateMetricValue} from './AnalyseUtils';
import {getDateStringFromDate} from './DateHelper';
import {handleAccumulationModeBatching} from './HandleAccumulationModeBatching';

/**
 * The exercise graph tab summarises its four existing metrics per day. Frequency
 * counts the trainings an exercise appeared in, which is always 1 for a single day,
 * so it is accumulated per week instead. The label shown next to the graph tells the
 * user which period is used.
 */
export const FREQUENCY_ACCUMULATION_MODE = AccumulationMode.WEEK;
export const FREQUENCY_PERIOD_LABEL = 'Trainings per week (Mon–Sun)';

// A gap of a few thousand buckets can only come from corrupt data; stop filling
// instead of looping forever.
const MAX_FILLED_BUCKETS = 5000;

const startOfNextWeek = (time: number) => {
  const date = new Date(time);
  // Day-based stepping, not +7*24h, so a DST switch inside the range cannot shift
  // the bucket boundary by an hour.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7, 0, 0, 0, 0).getTime();
};

/**
 * Fills the weeks between the first and the last week that has data with an explicit
 * zero. A week without a training really is a frequency of 0 — leaving it out would
 * draw a straight line across the gap and overstate the frequency in between.
 */
const fillEmptyWeeks = (points: {x: number; y: number}[]): {x: number; y: number}[] => {
  if (points.length < 2) return points;
  const filled: {x: number; y: number}[] = [];
  points.forEach((point, index) => {
    filled.push(point);
    const next = points[index + 1];
    if (next === undefined) return;
    let cursor = startOfNextWeek(point.x);
    let guard = 0;
    while (cursor < next.x && guard < MAX_FILLED_BUCKETS) {
      filled.push({x: cursor, y: 0});
      cursor = startOfNextWeek(cursor);
      guard++;
    }
  });
  return filled;
};

/**
 * Builds the Frequency series for one exercise. Reuses the app's existing Frequency
 * metric (`calculateMetricValue(..., Metric.FREQUENCY, workoutsCount)`), which counts
 * the workouts — i.e. the trainings the exercise appeared in — inside an accumulation
 * bucket.
 */
export function buildFrequencySeries(workouts: Workout[], accumulation: Accumulation): LineValue[] {
  const grouped = workouts.reduce(handleAccumulationModeBatching(workouts, accumulation), new Map<string, Workout[]>());

  const points = Array.from(grouped)
    .map(([bucketIso, bucketWorkouts]) => ({
      x: new Date(bucketIso).getTime(),
      y:
        calculateMetricValue(
          bucketWorkouts.flatMap((workout) => workout.sets),
          Metric.FREQUENCY,
          bucketWorkouts.length,
        ) ?? 0,
    }))
    .sort((a, b) => a.x - b.x);

  const complete = accumulation.getAccumulationMode() === AccumulationMode.WEEK ? fillEmptyWeeks(points) : points;

  return complete.map((point) => ({x: point.x, y: point.y, marker: `${point.y}`}) satisfies LineValue);
}

/**
 * Human readable summary of the most recent bucket, so the value the graph draws is
 * also readable as text (and assertable in e2e).
 */
export function formatFrequencyCaption(points: LineValue[]): string | undefined {
  const last = points[points.length - 1];
  if (last === undefined || last.x === undefined) return undefined;
  const count = last.y;
  return `Week of ${getDateStringFromDate(new Date(last.x))}: ${count} ${count === 1 ? 'training' : 'trainings'}`;
}
