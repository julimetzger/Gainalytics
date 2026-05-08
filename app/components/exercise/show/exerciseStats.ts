import {Exercise, Record} from '../../../models/entities/Exercise';

const toFiniteNumber = (v: unknown): number | undefined => {
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
