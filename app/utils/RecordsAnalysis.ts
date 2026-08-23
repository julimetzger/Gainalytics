import {Exercise, Record} from '../models/entities/Exercise';
import {Muscles} from '../models/Muscles';
import {Workout} from '../models/entities/Workout';
import {WorkoutSet} from '../models/entities/WorkoutSet';
import {Accumulation} from '../components/picker/elements/TrainingElementPicker';
import {AccumulationMode} from '../models/AccumulationMode';
import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {firstDayOfWeek, getFirstDayOfMonth, lastDayOfWeek} from './DateHelper';
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

function countByKey(workouts: Workout[], keyOf: (workout: Workout) => number | undefined): Map<number, number> {
  const counts = new Map<number, number>();
  workouts.forEach((workout) => {
    if (!workout.start) {
      return;
    }
    const key = keyOf(workout);
    if (key === undefined) {
      return;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

// ─── heatmap model ───────────────────────────────────────────────────────────

export interface HeatCell {
  key: string;
  count: number;
  /** Label rendered below the tile (month mode). */
  sublabel?: string;
}

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
    const counts = countByKey(recordWorkouts, (workout) => weekKey(new Date(workout.start!!)));
    const rows: HeatRow[] = monthsBetween(rangeStart, rangeEnd).map((month) => {
      const weeks = mondaysBetween(month, new Date(month.getFullYear(), month.getMonth() + 1, 0)).filter((monday) => monday.getMonth() === month.getMonth());
      return {
        label: MONTH_SHORT[month.getMonth()],
        cells: weeks.map((monday) => ({key: `week-${monday.getTime()}`, count: counts.get(monday.getTime()) ?? 0})),
      };
    });
    return finalizeModel(unit, rows);
  }

  if (unit === 'month') {
    const counts = countByKey(recordWorkouts, (workout) => monthKey(new Date(workout.start!!)));
    const cells = monthsBetween(rangeStart, rangeEnd).map((month) => ({
      key: `month-${month.getTime()}`,
      count: counts.get(month.getTime()) ?? 0,
      sublabel: MONTH_SHORT[month.getMonth()],
    }));
    return finalizeModel(unit, [{label: '', cells}]);
  }

  if (unit === 'day') {
    // Calendar grid: rows are weekdays Mon → Sun, columns are the weeks of the range.
    // Counts come from the actual training days of the record workouts.
    const counts = countByKey(recordWorkouts, (workout) => dayKey(new Date(workout.start!!)));
    const mondays = mondaysBetween(rangeStart, rangeEnd);
    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const perWeekday: number[][] = weekdayLabels.map((_, weekdayIndex) =>
      mondays.map((monday) => {
        const day = new Date(monday);
        day.setDate(day.getDate() + weekdayIndex);
        return counts.get(day.getTime()) ?? 0;
      }),
    );
    const rows: HeatRow[] = weekdayLabels.map((label, weekdayIndex) => {
      const bundled = bundleCounts(perWeekday[weekdayIndex], MAX_DAY_GRID_COLUMNS);
      return {
        label,
        cells: bundled.map((count, column) => ({key: `day-${weekdayIndex}-${column}`, count})),
      };
    });
    // Bundled cells sum several days — the "best day" KPI must stay a single day.
    const bestSingleDay = Math.max(0, ...Array.from(counts.values()));
    return finalizeModel(unit, rows, bestSingleDay);
  }

  // micro
  const plan = accumulation?.trainingsPlan;
  if (!plan) {
    return {unit, rows: [], maxCount: 0};
  }
  const tidToMicro = trainingsIdToMicro(plan);
  const counts = countByKey(recordWorkouts, (workout) => (workout.trainingsId !== undefined ? tidToMicro.get(workout.trainingsId) : undefined));
  const allMicros = Array.from(tidToMicro.values());
  const maxMicro = allMicros.length > 0 ? Math.max(...allMicros) : 0;
  const mesos = getSortedMesos(plan.mesos);
  const rows: HeatRow[] = mesos.map((meso, index) => {
    const nextStart = index + 1 < mesos.length ? mesos[index + 1].startMicro : maxMicro + 1;
    const cells: HeatCell[] = [];
    for (let micro = meso.startMicro; micro < nextStart; micro++) {
      cells.push({key: `micro-${micro}`, count: counts.get(micro) ?? 0});
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
  total: number;
}

export interface MuscleLaneModel {
  lanes: MuscleLane[];
  /** One entry per bucket; set where a new month (or micro) starts. */
  bucketLabels: (string | undefined)[];
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

  let bucketKeys: number[];
  let bucketLabels: (string | undefined)[];
  let keyOf: (workout: Workout) => number | undefined;

  if (unit === 'micro' && accumulation?.trainingsPlan) {
    const tidToMicro = trainingsIdToMicro(accumulation.trainingsPlan);
    const allMicros = Array.from(tidToMicro.values());
    const maxMicro = allMicros.length > 0 ? Math.max(...allMicros) : 0;
    bucketKeys = Array.from({length: maxMicro}, (_, index) => index + 1);
    bucketLabels = bucketKeys.map((micro) => `M${micro}`);
    keyOf = (workout) => (workout.trainingsId !== undefined ? tidToMicro.get(workout.trainingsId) : undefined);
  } else if (unit === 'month') {
    const months = monthsBetween(rangeStart, rangeEnd);
    bucketKeys = months.map((month) => month.getTime());
    bucketLabels = months.map((month) => MONTH_SHORT[month.getMonth()]);
    keyOf = (workout) => monthKey(new Date(workout.start!!));
  } else if (unit === 'day') {
    const days: Date[] = [];
    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= new Date(rangeEnd).getTime()) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    bucketKeys = days.map((day) => day.getTime());
    bucketLabels = days.map((day, index) => (index === 0 || day.getDate() === 1 ? MONTH_SHORT[day.getMonth()] : undefined));
    keyOf = (workout) => dayKey(new Date(workout.start!!));
  } else {
    const mondays = mondaysBetween(rangeStart, rangeEnd);
    bucketKeys = mondays.map((monday) => monday.getTime());
    bucketLabels = mondays.map((monday, index) => (index === 0 || monday.getMonth() !== mondays[index - 1].getMonth() ? MONTH_SHORT[monday.getMonth()] : undefined));
    keyOf = (workout) => weekKey(new Date(workout.start!!));
  }

  const bucketIndexByKey = new Map<number, number>(bucketKeys.map((key, index) => [key, index]));
  const lanesByGroup = new Map<MuscleGroup, number[]>();
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
      lanesByGroup.set(group, bucketKeys.map(() => 0));
    }
    lanesByGroup.get(group)!![bucketIndex] += 1;
  });

  // Bundle buckets so lanes stay readable for large ranges. Labels keep the
  // first non-empty label of each bundled group.
  const bundleNeeded = bucketKeys.length > MAX_LANE_BUCKETS;
  const groupSize = bundleNeeded ? Math.ceil(bucketKeys.length / MAX_LANE_BUCKETS) : 1;
  const finalLabels: (string | undefined)[] = [];
  if (bundleNeeded) {
    for (let i = 0; i < bucketLabels.length; i += groupSize) {
      finalLabels.push(bucketLabels.slice(i, i + groupSize).find((label) => label !== undefined));
    }
  } else {
    finalLabels.push(...bucketLabels);
  }

  const lanes: MuscleLane[] = Array.from(lanesByGroup.entries())
    .map(([group, counts]) => {
      const finalCounts = bundleNeeded ? bundleCounts(counts, MAX_LANE_BUCKETS) : counts;
      return {
        group,
        color: MUSCLE_GROUP_COLORS[group],
        counts: finalCounts,
        total: counts.reduce((sum, count) => sum + count, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {lanes, bucketLabels: finalLabels};
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
