import {BodyWeightEntry} from '../models/entities/BodyWeightEntry';

/** Plausible human body weights; anything outside is almost certainly a typo. */
export const MIN_BODY_WEIGHT_KG = 20;
export const MAX_BODY_WEIGHT_KG = 500;
export const MAX_BODY_WEIGHT_NOTE_LENGTH = 200;

export const startOfDay = (value: number | Date): number => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` in local time — the format of the date input field. */
export const formatBodyWeightDate = (value: number | Date): string => {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Parses `YYYY-MM-DD` to the local start of that day; `undefined` for anything that is not a real calendar date. */
export const parseBodyWeightDate = (text: string): number | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date.getTime();
};

/** Accepts `82.5` and `82,5`; `undefined` when the text is not a number. */
export const parseBodyWeightKg = (text: string): number | undefined => {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return undefined;
  }
  return Number(normalized);
};

export interface BodyWeightDraft {
  date: string;
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
  const date = parseBodyWeightDate(draft.date);
  if (date === undefined) {
    errors.date = 'Enter a valid date as YYYY-MM-DD';
  } else if (date > startOfDay(now)) {
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

/** Builds the entry (without id) for a draft that passed validation. */
export const draftToBodyWeightEntry = (draft: BodyWeightDraft): Omit<BodyWeightEntry, 'id'> => {
  const note = draft.note.trim();
  return {
    date: parseBodyWeightDate(draft.date)!,
    weightKg: Math.round(parseBodyWeightKg(draft.weight)! * 10) / 10,
    ...(note ? {note} : {}),
  };
};

export const formatWeightKg = (weightKg: number): string => `${(Math.round(weightKg * 10) / 10).toFixed(1)} kg`;

export const formatWeightChangeKg = (changeKg: number): string => {
  const rounded = Math.round(changeKg * 10) / 10;
  if (rounded === 0) {
    return '0.0 kg';
  }
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(1)} kg`;
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
