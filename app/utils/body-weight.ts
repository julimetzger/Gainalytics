import {BodyWeightEntry} from '../models/entities/BodyWeightEntry';
import {ensureFormat} from './numberInput';
import {formatPlanNumber} from './planRange';

/** Plausible human body weights; anything outside is almost certainly a typo. */
export const MIN_BODY_WEIGHT_KG = 20;
export const MAX_BODY_WEIGHT_KG = 500;
export const MAX_BODY_WEIGHT_NOTE_LENGTH = 200;

export const startOfDay = (value: number | Date): number => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** Accepts `82.5` and `82,5`; `undefined` when the text is not a number. */
export const parseBodyWeightKg = (text: string): number | undefined => {
  const normalized = ensureFormat(text.trim());
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return undefined;
  }
  return Number(normalized);
};

export interface BodyWeightDraft {
  /** Epoch ms of the picked day (any time of that day). */
  date: number;
  weight: string;
  note: string;
}

export interface BodyWeightValidationErrors {
  date?: string;
  weight?: string;
  note?: string;
}

export const validateBodyWeightDraft = (draft: BodyWeightDraft, now: number = Date.now()): BodyWeightValidationErrors => {
  const errors: BodyWeightValidationErrors = {};
  if (startOfDay(draft.date) > startOfDay(now)) {
    errors.date = 'The date cannot be in the future';
  }
  const weight = parseBodyWeightKg(draft.weight);
  if (weight === undefined) {
    errors.weight = 'Enter the weight in kg, e.g. 82.5';
  } else if (weight < MIN_BODY_WEIGHT_KG || weight > MAX_BODY_WEIGHT_KG) {
    errors.weight = `Weight must be between ${MIN_BODY_WEIGHT_KG} and ${MAX_BODY_WEIGHT_KG} kg`;
  }
  if (draft.note.length > MAX_BODY_WEIGHT_NOTE_LENGTH) {
    errors.note = `Note can have at most ${MAX_BODY_WEIGHT_NOTE_LENGTH} characters`;
  }
  return errors;
};

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

/** Builds the entry (without id) for a draft that passed validation. */
export const draftToBodyWeightEntry = (draft: BodyWeightDraft): Omit<BodyWeightEntry, 'id'> => {
  const note = draft.note.trim();
  return {
    date: startOfDay(draft.date),
    weightKg: roundToTenth(parseBodyWeightKg(draft.weight)!),
    ...(note ? {note} : {}),
  };
};

/** `82.5 kg` / `82 kg` — like logged set weights: no trailing zeros, always `.` as decimal separator. */
export const formatWeightKg = (weightKg: number): string => `${formatPlanNumber(roundToTenth(weightKg))} kg`;

export const formatWeightChangeKg = (changeKg: number): string => {
  const rounded = roundToTenth(changeKg);
  if (rounded === 0) {
    return '0 kg';
  }
  return `${rounded > 0 ? '+' : '-'}${formatWeightKg(Math.abs(rounded))}`;
};

/** Entries whose day lies within [start day, endMs], sorted ascending. */
export const entriesInRange = (entries: BodyWeightEntry[], startMs: number, endMs: number): BodyWeightEntry[] =>
  entries.filter((entry) => entry.date >= startOfDay(startMs) && entry.date <= endMs).sort((left, right) => left.date - right.date || left.id - right.id);

export interface BodyWeightStats {
  currentKg: number;
  /** Change between the first and the last entry of the range; `undefined` with a single entry. */
  changeKg?: number;
  minKg: number;
  maxKg: number;
}

/** `entries` must be sorted ascending by date. */
export const computeBodyWeightStats = (entries: BodyWeightEntry[]): BodyWeightStats | undefined => {
  if (entries.length === 0) {
    return undefined;
  }
  const weights = entries.map((entry) => entry.weightKg);
  const currentKg = entries[entries.length - 1].weightKg;
  return {
    currentKg,
    changeKg: entries.length > 1 ? currentKg - entries[0].weightKg : undefined,
    minKg: Math.min(...weights),
    maxKg: Math.max(...weights),
  };
};
