import {Exercise, Record} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {oneRepMaxForWorkouts} from '../../../utils/AnalyseUtils';

export const toFiniteNumber = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function lastOneRm(exercise: Exercise | undefined): number | undefined {
  const list = exercise?.records?.[Record.ONE_RM];
  if (!list || list.length === 0) return undefined;
  return toFiniteNumber(list[list.length - 1]?.value);
}

export function oneRmHistoryValues(exercise: Exercise | undefined, max = 12): number[] {
  const list = exercise?.records?.[Record.ONE_RM];
  if (!list || list.length === 0) return [];
  return list
    .slice(-max)
    .map((r) => toFiniteNumber(r?.value))
    .filter((n): n is number => n !== undefined);
}

// GH-477: best estimated 1RM of every FINISHED workout, oldest first, capped to
// the last `max` sessions. Unlike `oneRmHistoryValues` (which only holds new
// records and therefore can only rise) this shows weaker sessions too.
export function oneRmPerWorkoutValues(workouts: Workout[] | undefined, max = 12): number[] {
  if (!workouts || workouts.length === 0) return [];
  return workouts
    .filter((w) => w?.end !== undefined && w.end !== null)
    .map((w) => ({time: new Date(w.end!).getTime(), oneRm: oneRepMaxForWorkouts(w)}))
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.oneRm) && p.oneRm > 0)
    .sort((a, b) => a.time - b.time)
    .slice(-max)
    .map((p) => p.oneRm);
}

export function bestOneRm(exercise: Exercise | undefined): number | undefined {
  const values = oneRmHistoryValues(exercise, Number.MAX_SAFE_INTEGER);
  if (values.length === 0) return undefined;
  return Math.max(...values);
}

export function avgOneRm(exercise: Exercise | undefined): number | undefined {
  const values = oneRmHistoryValues(exercise, Number.MAX_SAFE_INTEGER);
  if (values.length === 0) return undefined;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

// Best 1RM excluding the most recent record — used to compute the "increase
// since previous best" delta shown on focus carousel cards.
export function previousBestOneRm(exercise: Exercise | undefined): number | undefined {
  const list = exercise?.records?.[Record.ONE_RM];
  if (!list || list.length < 2) return undefined;
  const earlier = list.slice(0, -1).map((r) => toFiniteNumber(r?.value)).filter((n): n is number => n !== undefined);
  if (earlier.length === 0) return undefined;
  return Math.max(...earlier);
}

// Absolute increase between the latest 1RM and the prior best. Returns undefined
// when there is no prior data to compare against.
export function oneRmIncreaseDelta(exercise: Exercise | undefined): number | undefined {
  const last = lastOneRm(exercise);
  const prev = previousBestOneRm(exercise);
  if (last === undefined || prev === undefined) return undefined;
  return last - prev;
}
