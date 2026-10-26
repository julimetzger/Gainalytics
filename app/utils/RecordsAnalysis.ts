import {Exercise, Record} from '../models/entities/Exercise';
import {Muscles} from '../models/Muscles';
import {Workout} from '../models/entities/Workout';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {Accumulation} from '../components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../models/AccumulationMode';
import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {firstDayOfWeek, getFirstDayOfMonth, getYYYYMMDDFormat, lastDayOfWeek} from './DateHelper';
import {getMicroFromTrainingInMicroIndex, getSortedMesos} from '../redux/Training/trainingsPlanReducer';
import {epley1RM} from './AnalyseUtils';
import {toFiniteNumber} from '../components/exercise/show/exerciseStats';

// ─── muscle groups ───────────────────────────────────────────────────────────

export type MuscleGroup = 'Legs' | 'Back' | 'Chest' | 'Shoulders' | 'Arms' | 'Core';

// Colors from the GH-341 design spec (derived from the three brand palettes).
// Core is not part of the spec's five groups; its muted teal keeps the same
// desaturated-pastel family without clashing with any of the five.
export const MUSCLE_GROUP_COLORS: {[group in MuscleGroup]: string} = {
  Legs: '#B1D18A',
  Back: '#DCB8FF',
  Chest: '#AAC7FF',
  Shoulders: '#BEC6DC',
  Arms: '#E7C8A0',
  Core: '#A5CCC3',
};

const MUSCLE_TO_GROUP: {[muscle in Muscles]: MuscleGroup} = {
  [Muscles.BACK]: 'Back',
  [Muscles.BICEPS]: 'Arms',
  [Muscles.CHEST]: 'Chest',
  [Muscles.CORE]: 'Core',
  [Muscles.GLUTES]: 'Legs',
  [Muscles.HAMSTRINGS]: 'Legs',
  [Muscles.QUADS]: 'Legs',
  [Muscles.SHOULDERS]: 'Shoulders',
  [Muscles.TRICEPS]: 'Arms',
};

/** Muscle group of the exercise's dominant muscle (highest percent). */
export function muscleGroupOf(exercise?: Exercise): MuscleGroup | undefined {
  const pairs = (exercise?.muscles ?? []).filter((pair) => pair.muscle !== undefined);
  if (pairs.length === 0) {
    return undefined;
  }
  const dominant = [...pairs].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
  return dominant.muscle ? MUSCLE_TO_GROUP[dominant.muscle] : undefined;
}

// ─── time buckets ────────────────────────────────────────────────────────────

export type HeatmapUnit = 'week' | 'month' | 'day' | 'micro';

export function unitForAccumulation(accumulation?: Accumulation): HeatmapUnit {
  switch (accumulation?.getAccumulationMode()) {
    case AccumulationMode.SINGLE_DAY:
      return 'day';
    case AccumulationMode.MONTH:
      return 'month';
    case AccumulationMode.TRAINING_MICROCYCLE:
      return 'micro';
    default:
      return 'week';
  }
}

const dayKey = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const weekKey = (date: Date) => firstDayOfWeek(new Date(date), 1).getTime();

const monthKey = (date: Date) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** MM/DD/YY, used in the titles of selected tiles. */
export function shortDate(date: Date): string {
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear() % 100).padStart(2, '0')}`;
}

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** All Mondays from the week containing `start` through the week containing `end`. */
export function mondaysBetween(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  let cursor = firstDayOfWeek(new Date(start), 1);
  const last = firstDayOfWeek(new Date(end), 1).getTime();
  while (cursor.getTime() <= last) {
    result.push(new Date(cursor));
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return result;
}

function monthsBetween(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  const s = new Date(start);
  const e = new Date(end);
  let cursor = new Date(s.getFullYear(), s.getMonth(), 1);
  const last = new Date(e.getFullYear(), e.getMonth(), 1).getTime();
  while (cursor.getTime() <= last) {
    result.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return result;
}

/** trainingsId → global micro number, from the plan's trainings map. */
function trainingsIdToMicro(plan: TrainingsPlan): Map<number, number> {
  const map = new Map<number, number>();
  Object.entries(plan.trainings ?? {}).forEach(([key, trainingsId]) => {
    map.set(trainingsId, getMicroFromTrainingInMicroIndex(key));
  });
  return map;
}

/** Record workouts grouped by bucket key — the same grouping feeds the tile counts and the tile filter. */
function groupByKey(workouts: Workout[], keyOf: (workout: Workout) => number | undefined): Map<number, Workout[]> {
  const groups = new Map<number, Workout[]>();
  workouts.forEach((workout) => {
    if (!workout.start) {
      return;
    }
    const key = keyOf(workout);
    if (key === undefined) {
      return;
    }
    const group = groups.get(key);
    if (group) {
      group.push(workout);
    } else {
      groups.set(key, [workout]);
    }
  });
  return groups;
}

// ─── heatmap model ───────────────────────────────────────────────────────────

/** A set of records behind one tile/bar; selecting it filters the record list. */
export interface RecordsSelection {
  key: string;
  /** Human-readable bucket, e.g. "week of 01/26/26". */
  title: string;
  workouts: Workout[];
}

export interface HeatCell extends RecordsSelection {
  count: number;
  /** Label rendered below the tile (month mode). */
  sublabel?: string;
}

const heatCell = (key: string, title: string, workouts: Workout[] = [], sublabel?: string): HeatCell => ({
  key,
  title,
  workouts,
  count: workouts.length,
  ...(sublabel !== undefined ? {sublabel} : {}),
});

export interface HeatRow {
  label: string;
  cells: HeatCell[];
}

export interface HeatmapModel {
  unit: HeatmapUnit;
  rows: HeatRow[];
  /** Highest cell count (cells may bundle several units for large ranges). */
  maxCount: number;
  /** Cell key of the best (highest-count) cell in the range. */
  bestKey?: string;
  /** Highest count of a single unit — differs from maxCount when cells are bundled. */
  bestCount: number;
}

/** Merge adjacent counts so at most `max` buckets remain (adaptive bundling for large ranges). */
export function bundleCounts(counts: number[], max: number): number[] {
  if (counts.length <= max) {
    return counts;
  }
  const groupSize = Math.ceil(counts.length / max);
  const bundled: number[] = [];
  for (let i = 0; i < counts.length; i += groupSize) {
    bundled.push(counts.slice(i, i + groupSize).reduce((sum, count) => sum + count, 0));
  }
  return bundled;
}

/** Same bundling as `bundleCounts`, but keeps the grouped items (counts = lengths). */
export function bundleGroups<T>(groups: T[][], max: number): T[][] {
  if (groups.length <= max) {
    return groups;
  }
  const groupSize = Math.ceil(groups.length / max);
  const bundled: T[][] = [];
  for (let i = 0; i < groups.length; i += groupSize) {
    bundled.push(groups.slice(i, i + groupSize).flat());
  }
  return bundled;
}

function finalizeModel(unit: HeatmapUnit, rows: HeatRow[], bestCount?: number): HeatmapModel {
  let maxCount = 0;
  let bestKey: string | undefined;
  rows.forEach((row) =>
    row.cells.forEach((cell) => {
      if (cell.count > maxCount) {
        maxCount = cell.count;
        bestKey = cell.key;
      }
    }),
  );
  return {unit, rows, maxCount, bestKey, bestCount: bestCount ?? maxCount};
}

export const MAX_DAY_GRID_COLUMNS = 16;

/**
 * Builds the tile grid for the records heatmap. Layout follows the accumulation mode:
 * week → month rows with week tiles, month → tiles per month, day → weekday rows
 * (Mon first) with week columns, micro → meso rows with micro tiles.
 */
export function buildHeatmapModel(recordWorkouts: Workout[], rangeStart: Date, rangeEnd: Date, accumulation?: Accumulation): HeatmapModel {
  const unit = unitForAccumulation(accumulation);

  if (unit === 'week') {
    const groups = groupByKey(recordWorkouts, (workout) => weekKey(new Date(workout.start!!)));
    const rows: HeatRow[] = monthsBetween(rangeStart, rangeEnd).map((month) => {
      const weeks = mondaysBetween(month, new Date(month.getFullYear(), month.getMonth() + 1, 0)).filter((monday) => monday.getMonth() === month.getMonth());
      return {
        label: MONTH_SHORT[month.getMonth()],
        cells: weeks.map((monday) => heatCell(`week-${getYYYYMMDDFormat(monday)}`, `week of ${shortDate(monday)}`, groups.get(monday.getTime()))),
      };
    });
    return finalizeModel(unit, rows);
  }

  if (unit === 'month') {
    const groups = groupByKey(recordWorkouts, (workout) => monthKey(new Date(workout.start!!)));
    const cells = monthsBetween(rangeStart, rangeEnd).map((month) =>
      heatCell(`month-${getYYYYMMDDFormat(month).slice(0, 7)}`, `${MONTH_SHORT[month.getMonth()]} ${month.getFullYear()}`, groups.get(month.getTime()), MONTH_SHORT[month.getMonth()]),
    );
    return finalizeModel(unit, [{label: '', cells}]);
  }

  if (unit === 'day') {
    // Calendar grid: rows are weekdays Mon → Sun, columns are the weeks of the range.
    // Counts come from the actual training days of the record workouts.
    const groups = groupByKey(recordWorkouts, (workout) => dayKey(new Date(workout.start!!)));
    const mondays = mondaysBetween(rangeStart, rangeEnd);
    const rows: HeatRow[] = WEEKDAY_SHORT.map((label, weekdayIndex) => {
      const days = mondays.map((monday) => addDays(monday, weekdayIndex));
      const bundledWorkouts = bundleGroups(
        days.map((day) => groups.get(day.getTime()) ?? []),
        MAX_DAY_GRID_COLUMNS,
      );
      const bundledDays = bundleGroups(
        days.map((day) => [day]),
        MAX_DAY_GRID_COLUMNS,
      );
      return {
        label,
        cells: bundledWorkouts.map((workouts, column) => {
          const first = bundledDays[column][0];
          const last = bundledDays[column][bundledDays[column].length - 1];
          const title = first === last ? `${label} ${shortDate(first)}` : `${label}s ${shortDate(first)} – ${shortDate(last)}`;
          return heatCell(`day-${weekdayIndex}-${column}`, title, workouts);
        }),
      };
    });
    // Bundled cells sum several days — the "best day" KPI must stay a single day.
    const bestSingleDay = Math.max(0, ...Array.from(groups.values()).map((group) => group.length));
    return finalizeModel(unit, rows, bestSingleDay);
  }

  // micro
  const plan = accumulation?.trainingsPlan;
  if (!plan) {
    return {unit, rows: [], maxCount: 0};
  }
  const tidToMicro = trainingsIdToMicro(plan);
  const groups = groupByKey(recordWorkouts, (workout) => (workout.trainingsId !== undefined ? tidToMicro.get(workout.trainingsId) : undefined));
  const allMicros = Array.from(tidToMicro.values());
  const maxMicro = allMicros.length > 0 ? Math.max(...allMicros) : 0;
  const mesos = getSortedMesos(plan.mesos);
  const rows: HeatRow[] = mesos.map((meso, index) => {
    const nextStart = index + 1 < mesos.length ? mesos[index + 1].startMicro : maxMicro + 1;
    const cells: HeatCell[] = [];
    for (let micro = meso.startMicro; micro < nextStart; micro++) {
      cells.push(heatCell(`micro-${micro}`, `${meso.name} · M${micro}`, groups.get(micro)));
    }
    return {label: meso.name, cells};
  });
  return finalizeModel(unit, rows.filter((row) => row.cells.length > 0));
}

// ─── by-muscle lanes ─────────────────────────────────────────────────────────

export interface MuscleLane {
  group: MuscleGroup;
  color: string;
  counts: number[];
  /** The record workouts behind each bar, aligned with `counts`. */
  workouts: Workout[][];
  total: number;
}

export interface MuscleLaneModel {
  lanes: MuscleLane[];
  /** One entry per bucket; set where a new month (or micro) starts. */
  bucketLabels: (string | undefined)[];
  /** Human-readable bucket per bar, e.g. "week of 01/26/26" or "01/05/26 – 01/18/26" when bundled. */
  bucketTitles: string[];
}

/** The records behind one bar of a muscle lane, as a list filter. */
export function laneSelection(model: MuscleLaneModel, lane: MuscleLane, index: number): RecordsSelection {
  return {key: `lane-${lane.group}-${index}`, title: `${lane.group} · ${model.bucketTitles[index]}`, workouts: lane.workouts[index] ?? []};
}

interface Bucket {
  key: number;
  label?: string;
  title: string;
  /** Calendar span (undefined for micros). */
  span?: [Date, Date];
}

function bundleTitle(buckets: Bucket[]): string {
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (first === last) {
    return first.title;
  }
  if (first.span && last.span) {
    return `${shortDate(first.span[0])} – ${shortDate(last.span[1])}`;
  }
  return `${first.title} – ${last.title}`;
}

export const MAX_LANE_BUCKETS = 18;

/**
 * One lane per muscle group over time, sorted by total records descending.
 * Buckets follow the accumulation mode; adjacent buckets are bundled for large ranges.
 */
export function buildMuscleLaneModel(recordWorkouts: Workout[], exercises: Exercise[], rangeStart: Date, rangeEnd: Date, accumulation?: Accumulation): MuscleLaneModel {
  const unit = unitForAccumulation(accumulation);
  const exercisesById = new Map<number, Exercise>();
  exercises.forEach((exercise) => {
    if (exercise.id !== undefined) {
      exercisesById.set(exercise.id, exercise);
    }
  });

  let buckets: Bucket[];
  let keyOf: (workout: Workout) => number | undefined;

  if (unit === 'micro' && accumulation?.trainingsPlan) {
    const tidToMicro = trainingsIdToMicro(accumulation.trainingsPlan);
    const allMicros = Array.from(tidToMicro.values());
    const maxMicro = allMicros.length > 0 ? Math.max(...allMicros) : 0;
    buckets = Array.from({length: maxMicro}, (_, index) => ({key: index + 1, label: `M${index + 1}`, title: `M${index + 1}`}));
    keyOf = (workout) => (workout.trainingsId !== undefined ? tidToMicro.get(workout.trainingsId) : undefined);
  } else if (unit === 'month') {
    buckets = monthsBetween(rangeStart, rangeEnd).map((month) => ({
      key: month.getTime(),
      label: MONTH_SHORT[month.getMonth()],
      title: `${MONTH_SHORT[month.getMonth()]} ${month.getFullYear()}`,
      span: [month, new Date(month.getFullYear(), month.getMonth() + 1, 0)],
    }));
    keyOf = (workout) => monthKey(new Date(workout.start!!));
  } else if (unit === 'day') {
    const days: Date[] = [];
    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= new Date(rangeEnd).getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    buckets = days.map((day, index) => ({
      key: day.getTime(),
      label: index === 0 || day.getDate() === 1 ? MONTH_SHORT[day.getMonth()] : undefined,
      title: `${WEEKDAY_SHORT[(day.getDay() + 6) % 7]} ${shortDate(day)}`,
      span: [day, day],
    }));
    keyOf = (workout) => dayKey(new Date(workout.start!!));
  } else {
    const mondays = mondaysBetween(rangeStart, rangeEnd);
    buckets = mondays.map((monday, index) => ({
      key: monday.getTime(),
      label: index === 0 || monday.getMonth() !== mondays[index - 1].getMonth() ? MONTH_SHORT[monday.getMonth()] : undefined,
      title: `week of ${shortDate(monday)}`,
      span: [monday, addDays(monday, 6)],
    }));
    keyOf = (workout) => weekKey(new Date(workout.start!!));
  }

  const bucketKeys = buckets.map((bucket) => bucket.key);
  const bucketLabels = buckets.map((bucket) => bucket.label);
  const bucketIndexByKey = new Map<number, number>(bucketKeys.map((key, index) => [key, index]));
  const lanesByGroup = new Map<MuscleGroup, Workout[][]>();
  recordWorkouts.forEach((workout) => {
    if (!workout.start) {
      return;
    }
    const group = muscleGroupOf(exercisesById.get(workout.exerciseId));
    if (!group) {
      return;
    }
    const key = keyOf(workout);
    const bucketIndex = key !== undefined ? bucketIndexByKey.get(key) : undefined;
    if (bucketIndex === undefined) {
      return;
    }
    if (!lanesByGroup.has(group)) {
      lanesByGroup.set(
        group,
        bucketKeys.map(() => []),
      );
    }
    lanesByGroup.get(group)!![bucketIndex].push(workout);
  });

  // Bundle buckets so lanes stay readable for large ranges. Labels keep the
  // first non-empty label of each bundled group.
  const bundleNeeded = bucketKeys.length > MAX_LANE_BUCKETS;
  const groupSize = bundleNeeded ? Math.ceil(bucketKeys.length / MAX_LANE_BUCKETS) : 1;
  const finalLabels: (string | undefined)[] = [];
  const finalTitles: string[] = [];
  for (let i = 0; i < buckets.length; i += groupSize) {
    finalLabels.push(bucketLabels.slice(i, i + groupSize).find((label) => label !== undefined));
    finalTitles.push(bundleTitle(buckets.slice(i, i + groupSize)));
  }

  const lanes: MuscleLane[] = Array.from(lanesByGroup.entries())
    .map(([group, perBucket]) => {
      const workouts = bundleGroups(perBucket, MAX_LANE_BUCKETS);
      return {
        group,
        color: MUSCLE_GROUP_COLORS[group],
        counts: workouts.map((bucket) => bucket.length),
        workouts,
        total: perBucket.reduce((sum, bucket) => sum + bucket.length, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {lanes, bucketLabels: finalLabels, bucketTitles: finalTitles};
}

// ─── record cards ────────────────────────────────────────────────────────────

export interface RecordCardModel {
  workoutId?: number;
  exerciseName: string;
  group?: MuscleGroup;
  groupColor?: string;
  oneRm: number;
  /** e.g. "150 kg × 5 @ 1 RIR" — the set that produced the record. */
  setLine?: string;
  dateLabel: string;
  /** Delta vs the previous 1RM record of the same exercise. */
  delta?: number;
  isTop: boolean;
}

/**
 * The set that produced the workout's 1RM record. Tagged sets win; otherwise
 * the set with the highest individual estimated 1RM (which is the one that
 * drove `workout.records[ONE_RM]` by definition of `repetitionMax`).
 */
export function findProducingSet(workout?: Workout): WorkoutSet | undefined {
  if (!workout || !Array.isArray(workout.sets) || workout.sets.length === 0) {
    return undefined;
  }
  const tagged = workout.sets.find((set) => Array.isArray(set.record) && set.record.includes(Record.ONE_RM));
  if (tagged) {
    return tagged;
  }
  let best: WorkoutSet | undefined;
  let bestOneRm = -Infinity;
  for (const set of workout.sets) {
    const oneRm = epley1RM(set.weight, set.reps, set.rir);
    if (oneRm > bestOneRm) {
      bestOneRm = oneRm;
      best = set;
    }
  }
  return bestOneRm > 0 ? best : undefined;
}

/** Delta of this workout's 1RM record vs the previous 1RM record of the same exercise. */
export function deltaToPreviousRecord(exercise: Exercise | undefined, workout: Workout): number | undefined {
  const history = exercise?.records?.[Record.ONE_RM];
  if (!history || workout.id === undefined) {
    return undefined;
  }
  const index = history.findIndex((entry) => entry.workoutId === workout.id);
  if (index <= 0) {
    return undefined;
  }
  const current = toFiniteNumber(history[index]?.value);
  const previous = toFiniteNumber(history[index - 1]?.value);
  if (current === undefined || previous === undefined) {
    return undefined;
  }
  return current - previous;
}

const formatWeight = (weight: number) => (Number.isInteger(weight) ? String(weight) : String(Math.round(weight * 100) / 100));

/** Card models sorted by 1RM descending; the first card is the top PR of the period. */
export function buildRecordCards(recordWorkouts: Workout[], exercises: Exercise[]): RecordCardModel[] {
  const exercisesById = new Map<number, Exercise>();
  exercises.forEach((exercise) => {
    if (exercise.id !== undefined) {
      exercisesById.set(exercise.id, exercise);
    }
  });

  const cards: RecordCardModel[] = [];
  recordWorkouts.forEach((workout) => {
    const oneRm = toFiniteNumber(workout.records?.[Record.ONE_RM]);
    if (oneRm === undefined) {
      return;
    }
    const exercise = exercisesById.get(workout.exerciseId);
    const group = muscleGroupOf(exercise);
    const producingSet = findProducingSet(workout);
    cards.push({
      workoutId: workout.id,
      exerciseName: exercise?.name ?? 'Unknown exercise',
      group,
      groupColor: group ? MUSCLE_GROUP_COLORS[group] : undefined,
      oneRm,
      setLine: producingSet ? `${formatWeight(producingSet.weight)} kg × ${producingSet.reps} @ ${producingSet.rir} RIR` : undefined,
      dateLabel: workout.start ? new Date(workout.start).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '—',
      delta: deltaToPreviousRecord(exercise, workout),
      isTop: false,
    });
  });

  cards.sort((a, b) => b.oneRm - a.oneRm);
  if (cards.length > 0) {
    cards[0].isTop = true;
  }
  return cards;
}

// ─── KPIs / status ───────────────────────────────────────────────────────────

/** Records set in the calendar week (Mon–Sun) containing `now`. */
export function countRecordsThisWeek(recordWorkouts: Workout[], now: Date): number {
  const start = firstDayOfWeek(new Date(now), 1).getTime();
  const end = lastDayOfWeek(new Date(now), 0).getTime();
  return recordWorkouts.filter((workout) => {
    if (!workout.start) {
      return false;
    }
    const time = new Date(workout.start).getTime();
    return time >= start && time <= end;
  }).length;
}

export function statusLine(recordsThisWeek: number): string {
  if (recordsThisWeek <= 0) {
    return 'No PRs this week yet';
  }
  return `Still climbing — ${recordsThisWeek} PR${recordsThisWeek === 1 ? '' : 's'} this week`;
}
