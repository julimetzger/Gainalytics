import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {ensureFormat} from '../../../utils/numberInput';
import {PlanField, PlanSetDraft} from './planTypes';

export const PLAN_CELL_TEST_ID = (setIndex: number, field: PlanField) => `plan-set-${setIndex}-${field}-cell`;

export const PLAN_INPUT_TEST_ID = (setIndex: number, field: PlanField) => `plan-set-${setIndex}-${field}-input`;

export function cloneWorkoutSet(workoutSet: WorkoutSet): WorkoutSet {
  return {
    ...workoutSet,
    date: workoutSet.date ? new Date(workoutSet.date) : undefined,
  };
}

export function getPlanSetDraft(workoutSet?: WorkoutSet): PlanSetDraft {
  return {
    reps: workoutSet?.reps !== undefined ? `${workoutSet.reps}` : '',
    rir: workoutSet?.rir !== undefined ? `${workoutSet.rir}` : '0',
    weight: workoutSet?.weight !== undefined ? formatPlanNumber(workoutSet.weight) : '',
  };
}

export function formatPlanNumber(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }
  return `${value}`.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
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

export function isPlanSetDraftValid(draft: PlanSetDraft): boolean {
  return (
    isPlanFieldValueValid('reps', draft.reps) &&
    isPlanFieldValueValid('rir', draft.rir) &&
    isPlanFieldValueValid('weight', draft.weight)
  );
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

  return {
    ...baseSet,
    reps,
    rir,
    weight,
  };
}
