import {LineValue} from 'react-native-charts-wrapper';
import {Accumulation} from '../models/Accumulation';
import {AccumulationMode} from '../models/AccumulationMode';
import {Metric} from '../models/Metric';
import {Workout} from '../models/entities/Workout';
import {Range} from '../components/picker/date/DateRangePicker';
import {calculateMetricValue} from './AnalyseUtils';
import {firstDayOfWeek, getDateStringFromDate} from './DateHelper';
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

/**
 * The selected range of the graph tab. The series covers this window completely, so a
 * week without a training is drawn as an explicit zero instead of ending the line at
 * the last training.
 */
export interface FrequencyWindow {
  /**
   * Start of the selected range. The week it falls into is plotted as a whole week — see
   * `frequencyQueryRange`. `undefined` for the "All" range, whose start is a sentinel far
   * before any data; there the series starts at the first week that has data.
   */
  start?: Date | number;
  /** End of the selected range, normally now. */
  end: Date | number;
}

/** Monday 00:00 of the week the given point in time falls into. */
export const weekStartOf = (value: Date | number): number => firstDayOfWeek(new Date(value), 1).getTime();

const startOfNextWeek = (time: number) => {
  const date = new Date(time);
  // Day-based stepping, not +7*24h, so a DST switch inside the range cannot shift
  // the bucket boundary by an hour.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7, 0, 0, 0, 0).getTime();
};

/**
 * The range the Frequency graph has to load its workouts from: the selected range, grown
 * back to the Monday of the week it starts in. A range that starts in the middle of a week
 * would otherwise produce a first point that is labelled as a full week but only counts
 * the days after the range start. The week is counted completely instead, and
 * `formatFrequencySpan` names it so the earlier start is visible to the user.
 */
export const frequencyQueryRange = (range: Range): Range => new Range(new Date(weekStartOf(range.startDate)), range.endDate);

/**
 * Walks every week between `from` and `to` and takes the count of the weeks that have
 * data. A week without a training really is a frequency of 0 — leaving it out would draw
 * a straight line across the gap and overstate the frequency in between, and stopping at
 * the last training would hide exactly the fact that the exercise is no longer trained.
 */
const fillWeeks = (points: {x: number; y: number}[], from: number, to: number): {x: number; y: number}[] => {
  const counts = new Map(points.map((point) => [point.x, point.y]));
  const filled: {x: number; y: number}[] = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < MAX_FILLED_BUCKETS) {
    filled.push({x: cursor, y: counts.get(cursor) ?? 0});
    cursor = startOfNextWeek(cursor);
    guard++;
  }
  return filled;
};

const toLineValues = (points: {x: number; y: number}[]): LineValue[] =>
  points.map((point) => ({x: point.x, y: point.y, marker: `${point.y}`}) satisfies LineValue);

/**
 * Builds the Frequency series for one exercise. Reuses the app's existing Frequency
 * metric (`calculateMetricValue(..., Metric.FREQUENCY, workoutsCount)`), which counts
 * the workouts — i.e. the trainings the exercise appeared in — inside an accumulation
 * bucket.
 */
export function buildFrequencySeries(workouts: Workout[], accumulation: Accumulation, window?: FrequencyWindow): LineValue[] {
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

  if (accumulation.getAccumulationMode() !== AccumulationMode.WEEK) return toLineValues(points);

  // No training at all in the selected range: the card shows the same empty state as the
  // other four graphs instead of a made-up zero line.
  if (points.length === 0) return [];

  const from = window?.start !== undefined ? weekStartOf(window.start) : points[0].x;
  const to = window?.end !== undefined ? weekStartOf(window.end) : points[points.length - 1].x;
  if (from > to) return toLineValues(points);

  return toLineValues(fillWeeks(points, from, to));
}

/**
 * The span the graph actually covers. Makes it visible that the series runs to the end of
 * the selected range and where it starts, so a week-aligned boundary is not implicit.
 */
export function formatFrequencySpan(points: LineValue[]): string | undefined {
  const first = points[0];
  const last = points[points.length - 1];
  if (first?.x === undefined || last?.x === undefined) return undefined;
  return `Weeks from ${getDateStringFromDate(new Date(first.x))} to ${getDateStringFromDate(new Date(last.x))}`;
}

const trainings = (count: number) => `${count} ${count === 1 ? 'training' : 'trainings'}`;

/**
 * Human readable summary of the most recent bucket, so the value the graph draws is
 * also readable as text (and assertable in e2e). The week that contains `now` is still
 * running, so its count is marked as partial; if it is empty, the last week that did
 * contain a training is named — that is the information the graph's trailing zeros show.
 */
export function formatFrequencyCaption(points: LineValue[], now?: Date | number): string | undefined {
  const last = points[points.length - 1];
  if (last === undefined || last.x === undefined) return undefined;

  const isRunningWeek = now !== undefined && weekStartOf(now) === last.x;
  const week = `Week of ${getDateStringFromDate(new Date(last.x))}`;
  const base = `${week}: ${trainings(last.y)}${isRunningWeek ? ' so far' : ''}`;
  if (last.y > 0) return base;

  const lastTrained = [...points].reverse().find((point) => point.y > 0);
  if (lastTrained?.x === undefined) return base;
  return `${base}, last trained ${getDateStringFromDate(new Date(lastTrained.x))} (${trainings(lastTrained.y)})`;
}
