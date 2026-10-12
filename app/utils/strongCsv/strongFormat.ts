/**
 * The Strong CSV format (GH-496). Strong 6.x exports one row per set, `;`-separated,
 * every field quoted, with this header (verified against real Strong exports, see the
 * GH-496 summary for sources):
 *
 *   "Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";
 *   "Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"
 *
 * Older Strong versions wrote `,`-separated files with `Duration` ("1h 5m"), `Weight`
 * (no unit) and the RPE column last. The importer reads both.
 */
export const STRONG_EXPORT_HEADER = [
  'Workout #',
  'Date',
  'Workout Name',
  'Duration (sec)',
  'Exercise Name',
  'Set Order',
  'Weight (kg)',
  'Reps',
  'RPE',
  'Distance (meters)',
  'Seconds',
  'Notes',
  'Workout Notes',
];

export const STRONG_EXPORT_DELIMITER = ';';

/** Pounds → kilograms. */
export const LB_TO_KG = 0.45359237;

/** RPE = 10 − RIR. Gainalytics stores RIR, Strong stores RPE. */
export const rirToRpe = (rir: number): number => 10 - rir;
export const rpeToRir = (rpe: number): number => 10 - rpe;

const pad = (value: number) => String(value).padStart(2, '0');

/** Strong's date format: local time, `YYYY-MM-DD HH:mm:ss`. */
export function formatStrongDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Parses `YYYY-MM-DD HH:mm[:ss]` (also with a `T`) as local time; undefined if malformed. */
export function parseStrongDate(value: string): Date | undefined {
  const match = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(value);
  if (!match) return undefined;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  // Reject rollovers such as 2024-02-31.
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return undefined;
  return date;
}

/** `"4419"` (seconds, Strong 6.x) or `"1h 8m"` / `"42m"` / `"38min"` / `"45s"` (older Strong). */
export function parseStrongDuration(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed));
  const pattern = /(\d+)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/gi;
  let seconds = 0;
  let matched = false;
  let part: RegExpExecArray | null;
  while ((part = pattern.exec(trimmed)) !== null) {
    matched = true;
    const amount = Number(part[1]);
    const unit = part[2].toLowerCase();
    if (unit.startsWith('h')) seconds += amount * 3600;
    else if (unit.startsWith('m')) seconds += amount * 60;
    else seconds += amount;
  }
  return matched ? seconds : undefined;
}

/** `"50.0"`, `"50"`, `"50,5"` → number; empty or garbage → undefined. */
export function parseStrongNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().replace(/^(-?\d+),(\d+)$/, '$1.$2');
  if (trimmed === '') return undefined;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
}

/** Strong writes weights with one decimal (`100.0`); keep up to two for converted values. */
export function formatStrongWeight(weight: number): string {
  if (Number.isInteger(weight)) return weight.toFixed(1);
  return String(Math.round(weight * 100) / 100);
}

export function formatStrongNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}
