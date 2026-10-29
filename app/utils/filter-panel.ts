import {Range} from '../components/picker/date/DateRangePicker';
import {Accumulation} from '../models/Accumulation';
import {AccumulationMode} from '../models/AccumulationMode';
import {Exercise} from '../models/entities/Exercise';
import {Metric} from '../models/Metric';
import {Muscles} from '../models/Muscles';
import {getEndOfDay} from './DateHelper';

/**
 * GH-642: pure helpers behind the Analyse filter panel (range length chips,
 * range stepping, the three summary lines of the collapsed card) and the
 * exercise search sheet ("Recent", "2 days ago").
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type RangePreset = '4W' | '3M' | '6M' | '1Y';

export const RANGE_PRESETS: {preset: RangePreset; days: number}[] = [
  {preset: '4W', days: 28},
  {preset: '3M', days: 92},
  {preset: '6M', days: 183},
  {preset: '1Y', days: 365},
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** A range of the preset's length that ends today (inclusive), e.g. 3M on 27 Oct → 28 Jul – 27 Oct. */
export const rangeForPreset = (preset: RangePreset, today: Date = new Date()): Range => {
  const end = getEndOfDay(today);
  const start = startOfDay(today);
  if (preset === '4W') {
    start.setDate(start.getDate() - 27);
  } else {
    start.setMonth(start.getMonth() - (preset === '3M' ? 3 : preset === '6M' ? 6 : 12));
    start.setDate(start.getDate() + 1);
  }
  return new Range(start, end);
};

/** The preset whose length the range has (±10 %, so the default "3 months to end of week" counts as 3M), else undefined = Custom. */
export const presetOfRange = (range: Range): RangePreset | undefined => {
  const days = (range.endDate.getTime() - range.startDate.getTime()) / DAY_MS;
  return RANGE_PRESETS.find((it) => Math.abs(days - it.days) <= it.days * 0.1)?.preset;
};

export const canStepForward = (range: Range, today: Date = new Date()) => range.endDate.getTime() < startOfDay(today).getTime() + DAY_MS - 1000;

/** The next period of the same length, but never past the end of today. */
export const stepRangeForward = (range: Range, today: Date = new Date()): Range => {
  const next = range.plusOneRange();
  const endOfToday = getEndOfDay(today);
  if (next.endDate.getTime() <= endOfToday.getTime()) {
    return next;
  }
  const length = range.endDate.getTime() - range.startDate.getTime();
  return new Range(new Date(endOfToday.getTime() - length), endOfToday);
};

const dayMonth = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;

/** "28 Jul – 27 Oct 2026"; the start keeps its own year when the range spans a year change. */
export const formatRangeLabel = (range: Range) => {
  const {startDate, endDate} = range;
  const start = startDate.getFullYear() === endDate.getFullYear() ? dayMonth(startDate) : `${dayMonth(startDate)} ${startDate.getFullYear()}`;
  return `${start} – ${dayMonth(endDate)} ${endDate.getFullYear()}`;
};

/** "Squat, Bench Press · Quads"; "All exercises" without a selection. */
export const formatSelectionSummary = (exercises: Exercise[], muscles: Muscles[]) => {
  const parts = [exercises.map((it) => it.name).join(', '), muscles.join(', ')].filter((it) => it.length > 0);
  return parts.length > 0 ? parts.join(' · ') : 'All exercises';
};

export type GroupByOption = 'Day' | 'Week' | 'Month' | 'Micro';

export const GROUP_BY_OPTIONS: {value: GroupByOption; mode: AccumulationMode}[] = [
  {value: 'Day', mode: AccumulationMode.SINGLE_DAY},
  {value: 'Week', mode: AccumulationMode.WEEK},
  {value: 'Month', mode: AccumulationMode.MONTH},
  {value: 'Micro', mode: AccumulationMode.TRAINING_MICROCYCLE},
];

export const groupByOf = (accumulation?: Accumulation): GroupByOption | undefined => GROUP_BY_OPTIONS.find((it) => it.mode === accumulation?.accumulationMode)?.value;

/** "Week", "Micro (Push pull)". */
export const formatGroupBy = (accumulation?: Accumulation) => {
  const groupBy = groupByOf(accumulation);
  if (groupBy === undefined) {
    return 'No grouping';
  }
  return groupBy === 'Micro' && accumulation?.trainingsPlan ? `Micro (${accumulation.trainingsPlan.name})` : groupBy;
};

/** "Week · Volume, Frequency" — metrics only where the screen filters them; none selected means all of them. */
export const formatGroupByAndMetrics = (accumulation: Accumulation | undefined, metrics: Metric[] | undefined) => {
  const parts: string[] = [];
  if (accumulation !== undefined) {
    parts.push(formatGroupBy(accumulation));
  }
  if (metrics !== undefined) {
    parts.push(metrics.length > 0 ? metrics.join(', ') : 'All metrics');
  }
  return parts.join(' · ');
};

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'} ago`;

/** "today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago", "2 years ago". */
export const formatAgo = (date: Date, now: Date = new Date()) => {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(date)).getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return plural(days, 'day');
  if (days < 60) return plural(Math.floor(days / 7), 'week');
  if (days < 365) return plural(Math.floor(days / 30), 'month');
  return plural(Math.floor(days / 365), 'year');
};

export interface ExerciseTrainingStat {
  /** Logged workouts (with at least one set). */
  count: number;
  /** Timestamp of the newest logged workout. */
  last: number;
}

export const MOST_TRAINED_LIMIT = 6;

/** The most-trained exercises (by logged workouts) followed by every selected one that is not among them. Order stays stable while toggling. */
export const quickPickExercises = (exercises: Exercise[], stats: Record<number, ExerciseTrainingStat>, selected: Exercise[], limit: number = MOST_TRAINED_LIMIT): Exercise[] => {
  const mostTrained = exercises
    .filter((it) => it.id !== undefined && (stats[it.id]?.count ?? 0) > 0)
    .sort((a, b) => stats[b.id!].count - stats[a.id!].count || a.name.localeCompare(b.name))
    .slice(0, limit);
  const shownIds = new Set(mostTrained.map((it) => it.id));
  return [...mostTrained, ...selected.filter((it) => !shownIds.has(it.id))];
};

export const RECENT_LIMIT = 5;

/** The exercises trained last, newest first. */
export const recentExercises = (exercises: Exercise[], stats: Record<number, ExerciseTrainingStat>, limit: number = RECENT_LIMIT): Exercise[] =>
  exercises
    .filter((it) => it.id !== undefined && stats[it.id] !== undefined)
    .sort((a, b) => stats[b.id!].last - stats[a.id!].last)
    .slice(0, limit);

/** Case-insensitive name filter, A–Z. */
export const filterExercisesByName = (exercises: Exercise[], query: string): Exercise[] => {
  const needle = query.trim().toLowerCase();
  return exercises.filter((it) => needle.length === 0 || it.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name));
};

/** Toggles an exercise by id, keeping the selection order. */
export const toggleExercise = (selected: Exercise[], exercise: Exercise): Exercise[] =>
  selected.some((it) => it.id === exercise.id) ? selected.filter((it) => it.id !== exercise.id) : [...selected, exercise];
