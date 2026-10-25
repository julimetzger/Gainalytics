import {Training} from '../models/entities/Training';
import {Workout} from '../models/entities/Workout';
import {Metric} from '../models/Metric';
import {calculateMetricValue} from './AnalyseUtils';

/**
 * GH-526 — formatting for the Overview / training analysis rework: every view
 * compares exactly two things, its KPI cards read `value / reference` with the
 * delta below, and the header carries the date right of the title.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

const toDate = (value: Date | string | number | undefined): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const dayMonth = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
const dayMonthYear = (date: Date) => `${dayMonth(date)}/${date.getFullYear()}`;

/** `Mon 13/10/2026` */
export const formatTrainingDate = (value: Date | string | number | undefined): string | undefined => {
  const date = toDate(value);
  return date ? `${WEEKDAYS[date.getDay()]} ${dayMonthYear(date)}` : undefined;
};

/** `18:02 – 19:25` */
export const formatTimeRange = (start: Date | string | number | undefined, end: Date | string | number | undefined): string | undefined => {
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) return undefined;
  const time = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${time(from)} – ${time(to)}`;
};

/** `06/10 – 12/10/2026` — the span of the dated trainings of a micro; the year is repeated only when it changes. */
export const formatMicroDateRange = (trainings: Training[]): string | undefined => {
  const times: number[] = [];
  for (const training of trainings) {
    const start = toDate(training.start);
    const end = toDate(training.end);
    if (start) times.push(start.getTime());
    if (end) times.push(end.getTime());
  }
  if (times.length === 0) return undefined;
  const first = new Date(Math.min(...times));
  const last = new Date(Math.max(...times));
  if (dayMonthYear(first) === dayMonthYear(last)) return dayMonthYear(first);
  const from = first.getFullYear() === last.getFullYear() ? dayMonth(first) : dayMonthYear(first);
  return `${from} – ${dayMonthYear(last)}`;
};

/** Duration of one training in ms; a live training counts up to `now`, an unstarted one is 0. */
export const trainingDurationMs = (training: Training | undefined, now: number = Date.now()): number => {
  const start = toDate(training?.start);
  if (!start) return 0;
  const end = toDate(training?.end)?.getTime() ?? now;
  return Math.max(0, end - start.getTime());
};

/** `4h 12min`, `58min` */
export const formatDurationShort = (ms: number): string => {
  const totalMinutes = Math.round(Math.abs(ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
};

const signOf = (difference: number): -1 | 0 | 1 => (difference > 0 ? 1 : difference < 0 ? -1 : 0);
const signed = (sign: -1 | 0 | 1, magnitude: string) => (sign === 0 ? `±${magnitude}` : `${sign > 0 ? '+' : '−'}${magnitude}`);

/** One KPI card: `value / reference`, below it the delta (or the share). */
export interface Kpi {
  key: string;
  title: string;
  value: string;
  reference?: string;
  /** Second line under the value — the delta (`+4 (+7%)`) or the share (`21% of micro plan`). */
  delta?: string;
  /** Colours the delta: below the reference reads as error, above as primary. */
  sign: -1 | 0 | 1;
}

export type KpiMode = 'diff' | 'share';

const percent = (difference: number, reference: number) => {
  if (reference === 0) return undefined;
  const pct = Math.round((difference / reference) * 100);
  return pct === 0 ? '±0%' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`;
};

const formatVolume = (kg: number) => `${(kg / 1000).toFixed(1)}t`;
const formatCount = (n: number) => String(Math.round(n));

const numericKpi = (
  key: string,
  title: string,
  value: number,
  reference: number | undefined,
  format: (n: number) => string,
  mode: KpiMode,
  shareOf?: string,
): Kpi => {
  if (reference === undefined) return {key, title, value: format(value), sign: 0};
  if (mode === 'share') {
    const share = reference > 0 ? `${Math.round((value / reference) * 100)}%` : '–';
    return {key, title, value: format(value), reference: format(reference), delta: shareOf ? `${share} of ${shareOf}` : share, sign: 0};
  }
  const difference = value - reference;
  // compare what is displayed, so 34.21t vs 34.24t does not read "−0.0t"
  const shownDifference = Number(format(Math.abs(difference)).replace(/[^0-9.]/g, '')) === 0 ? 0 : difference;
  const sign = signOf(shownDifference);
  const pct = percent(difference, reference);
  const delta = signed(sign, format(Math.abs(difference))) + (pct ? ` (${pct})` : '');
  return {key, title, value: format(value), reference: format(reference), delta, sign};
};

/**
 * GH-527 (H5) — the planned workouts every overview and analysis compares. A plan
 * keeps the sets of an exercise that was later removed from the training; they stay
 * stored, but no longer count: the Plan tab only lists the training's exercises, so
 * the muscle map, the Muscle Overview and the Sets KPI must not plan more than that.
 * A legacy training without an exercise list keeps all of its planned workouts.
 */
export const plannedWorkoutIdsOf = (trainings: (Training | undefined)[]): number[] =>
  trainings.flatMap((training) => {
    if (!training?.plannedWorkouts) return [];
    const listed = Array.isArray(training.exercises) ? new Set(training.exercises.map(Number)) : undefined;
    return Object.entries(training.plannedWorkouts)
      .filter(([exerciseId]) => listed === undefined || listed.has(Number(exerciseId)))
      .map(([, workoutId]) => workoutId);
  });

export const doneWorkoutIdsOf = (trainings: (Training | undefined)[]): number[] =>
  trainings.flatMap((training) => (training?.doneWorkoutIds ? (Object.values(training.doneWorkoutIds) as number[]) : []));

export const setsOf = (workouts: Workout[]) => calculateMetricValue(workouts.flatMap((workout) => workout.sets ?? []), Metric.SETS) ?? 0;
export const volumeOf = (workouts: Workout[]) => calculateMetricValue(workouts.flatMap((workout) => workout.sets ?? []), Metric.VOLUME) ?? 0;

export const setsKpi = (subject: Workout[], reference: Workout[] | undefined, mode: KpiMode = 'diff', shareOf?: string): Kpi =>
  numericKpi('sets', 'Sets', setsOf(subject), reference ? setsOf(reference) : undefined, formatCount, mode, shareOf);

export const volumeKpi = (subject: Workout[], reference: Workout[] | undefined, mode: KpiMode = 'diff', shareOf?: string): Kpi =>
  numericKpi('volume', 'Volume', volumeOf(subject), reference ? volumeOf(reference) : undefined, formatVolume, mode, shareOf);

export const countKpi = (key: string, title: string, value: number, reference: number | undefined): Kpi => numericKpi(key, title, value, reference, formatCount, 'diff');

/** Duration only exists for done trainings; the delta is shown without a percentage. */
export const durationKpi = (valueMs: number, referenceMs: number | undefined, title = 'Duration'): Kpi => {
  if (referenceMs === undefined) return {key: 'duration', title, value: formatDurationShort(valueMs), sign: 0};
  const difference = valueMs - referenceMs;
  const sign = signOf(Math.round(difference / 60000));
  return {key: 'duration', title, value: formatDurationShort(valueMs), reference: formatDurationShort(referenceMs), delta: signed(sign, formatDurationShort(difference)), sign};
};
