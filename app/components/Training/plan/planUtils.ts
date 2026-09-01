import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {ensureFormat} from '../../../utils/numberInput';
import {
  formatPlanNumber,
  getPlanRangeMax,
  PLAN_RANGE_FIELDS,
  planRangeMaxField,
  withPlanRangeMax,
} from '../../../utils/planRange';
import {PlanField, PlanSetDraft} from './planTypes';

export {formatPlanNumber};

export const PLAN_CELL_TEST_ID = (setIndex: number, field: PlanField) => `plan-set-${setIndex}-${field}-cell`;

export const PLAN_INPUT_TEST_ID = (setIndex: number, field: PlanField) => `plan-set-${setIndex}-${field}-input`;

/**
 * Do two sets carry the same planned numbers? Compares the index and all six
 * planned fields — the lower bounds and, since GH-63, their optional upper
 * bounds. Ignores everything the plan editor never touches (date, records).
 */
export function planSetsEqual(left: WorkoutSet | undefined | null, right: WorkoutSet | undefined | null): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }
  return (
    left.index === right.index &&
    left.reps === right.reps &&
    left.rir === right.rir &&
    left.weight === right.weight &&
    left.repsMax === right.repsMax &&
    left.rirMax === right.rirMax &&
    left.weightMax === right.weightMax
  );
}

export function cloneWorkoutSet(workoutSet: WorkoutSet): WorkoutSet {
  return {
    ...workoutSet,
    date: workoutSet.date ? new Date(workoutSet.date) : undefined,
  };
}

export function getPlanSetDraft(workoutSet?: WorkoutSet): PlanSetDraft {
  const rangeMax = (field: PlanField) => {
    const max = getPlanRangeMax(workoutSet, field);
    return max !== undefined ? formatPlanNumber(max) : '';
  };

  return {
    reps: workoutSet?.reps !== undefined ? `${workoutSet.reps}` : '',
    rir: workoutSet?.rir !== undefined ? `${workoutSet.rir}` : '0',
    weight: workoutSet?.weight !== undefined ? formatPlanNumber(workoutSet.weight) : '',
    repsMax: rangeMax('reps'),
    rirMax: rangeMax('rir'),
    weightMax: rangeMax('weight'),
  };
}

export function getPlanFieldLabel(field: PlanField): string {
  switch (field) {
    case 'reps':
      return 'reps';
    case 'rir':
      return 'RIR';
    case 'weight':
      return 'weight';
  }
}

const PLAN_FIELD_TITLE: Record<PlanField, string> = {
  reps: 'Reps',
  rir: 'RIR',
  weight: 'Weight',
};

const PLAN_FIELD_RULE: Record<PlanField, string> = {
  reps: 'Reps must be a whole number from 1 to 99.',
  rir: 'RIR must be a whole number from 0 to 10.',
  weight: 'Weight must be between 0 and 999.9 kg in 0.25 steps.',
};

export function parsePlanFieldValue(field: PlanField, rawValue: string): number | null {
  const value = Number.parseFloat(ensureFormat(rawValue));

  if (!Number.isFinite(value)) {
    return null;
  }

  if (field === 'reps') {
    return Math.round(value);
  }

  if (field === 'rir') {
    return Math.round(value);
  }

  return Math.round(value * 100) / 100;
}

export function isPlanFieldValueValid(field: PlanField, rawValue: string): boolean {
  const normalized = ensureFormat(rawValue).trim();

  if (normalized.length === 0) {
    return false;
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) {
    return false;
  }

  if (field === 'reps') {
    return Number.isInteger(value) && value >= 1 && value <= 99;
  }

  if (field === 'rir') {
    return Number.isInteger(value) && value >= 0 && value <= 10;
  }

  if (value < 0 || value > 999.9) {
    return false;
  }

  return Math.abs(value * 4 - Math.round(value * 4)) < 0.0001;
}

export function isPlanRangeMaxEmpty(rawValue: string): boolean {
  return ensureFormat(rawValue).trim().length === 0;
}

/**
 * GH-63: the message shown to the user when the upper bound of a range cannot be
 * accepted. `undefined` means the range is fine — including the empty upper
 * bound, which simply keeps the field a fixed value.
 */
export function getPlanRangeError(field: PlanField, minRaw: string, maxRaw: string): string | undefined {
  if (isPlanRangeMaxEmpty(maxRaw)) {
    return undefined;
  }

  if (!isPlanFieldValueValid(field, maxRaw)) {
    return PLAN_FIELD_RULE[field];
  }

  if (!isPlanFieldValueValid(field, minRaw)) {
    // The lower bound is flagged by its own field; nothing extra to say here.
    return undefined;
  }

  const min = parsePlanFieldValue(field, minRaw);
  const max = parsePlanFieldValue(field, maxRaw);
  if (min === null || max === null) {
    return undefined;
  }

  if (max <= min) {
    return `${PLAN_FIELD_TITLE[field]} range: the second value must be greater than ${formatPlanNumber(min)}.`;
  }

  return undefined;
}

export function getPlanDraftRangeError(draft: PlanSetDraft): string | undefined {
  for (const field of PLAN_RANGE_FIELDS) {
    const error = getPlanRangeError(field, draft[field], draft[planRangeMaxField(field)]);
    if (error !== undefined) {
      return error;
    }
  }
  return undefined;
}

export function isPlanSetDraftValid(draft: PlanSetDraft): boolean {
  return (
    isPlanFieldValueValid('reps', draft.reps) &&
    isPlanFieldValueValid('rir', draft.rir) &&
    isPlanFieldValueValid('weight', draft.weight) &&
    getPlanDraftRangeError(draft) === undefined
  );
}

/**
 * GH-63: quick edit changes the lower bound of a field in place. Setting it to
 * or above an existing upper bound would invert the range, so it is rejected
 * with the same message the full editor shows.
 */
export function getQuickEditError(workoutSet: WorkoutSet | undefined, field: PlanField, rawValue: string): string | undefined {
  if (!isPlanFieldValueValid(field, rawValue)) {
    return PLAN_FIELD_RULE[field];
  }

  const max = getPlanRangeMax(workoutSet, field);
  if (max === undefined) {
    return undefined;
  }

  const value = parsePlanFieldValue(field, rawValue);
  if (value === null || value < max) {
    return undefined;
  }

  return `${PLAN_FIELD_TITLE[field]} range: the first value must be less than ${formatPlanNumber(max)}.`;
}

export function buildWorkoutSetFromDraft(draft: PlanSetDraft, baseSet?: WorkoutSet): WorkoutSet | null {
  if (!isPlanSetDraftValid(draft)) {
    return null;
  }

  const reps = parsePlanFieldValue('reps', draft.reps);
  const rir = parsePlanFieldValue('rir', draft.rir);
  const weight = parsePlanFieldValue('weight', draft.weight);

  if (reps === null || rir === null || weight === null) {
    return null;
  }

  let next: WorkoutSet = {
    ...baseSet,
    reps,
    rir,
    weight,
  };

  PLAN_RANGE_FIELDS.forEach((field) => {
    const rawMax = draft[planRangeMaxField(field)];
    const max = isPlanRangeMaxEmpty(rawMax) ? undefined : parsePlanFieldValue(field, rawMax) ?? undefined;
    next = withPlanRangeMax(next, field, max);
  });

  return next;
}
