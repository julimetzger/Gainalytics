import {WorkoutSet} from '../models/entities/WorkoutSet';

/**
 * GH-63 — planned rep/weight/RIR ranges.
 *
 * A planned set may express a target as a range instead of a fixed number. The
 * lower bound is stored in the existing `reps` / `rir` / `weight` fields, the
 * optional upper bound in `repsMax` / `rirMax` / `weightMax`.
 *
 * THE RULE, defined here once and reused everywhere:
 *
 *   > In every evaluation a range counts with its LOWER bound.
 *
 * Because the lower bound *is* the value that was always stored, plans without
 * ranges produce byte-identical numbers to before this feature. Evaluations must
 * read planned set values through {@link evaluationReps}, {@link evaluationRir}
 * and {@link evaluationWeight} instead of touching the fields directly, so the
 * rule stays in one place.
 */

export type PlanRangeField = 'reps' | 'rir' | 'weight';

export type PlanRangeMaxField = 'repsMax' | 'rirMax' | 'weightMax';

export const PLAN_RANGE_FIELDS: PlanRangeField[] = ['reps', 'rir', 'weight'];

const MAX_FIELD_BY_FIELD: Record<PlanRangeField, PlanRangeMaxField> = {
  reps: 'repsMax',
  rir: 'rirMax',
  weight: 'weightMax',
};

const UNIT_LABEL: Record<PlanRangeField, string> = {
  reps: 'reps',
  rir: 'RIR',
  weight: 'kg',
};

export const planRangeMaxField = (field: PlanRangeField): PlanRangeMaxField => MAX_FIELD_BY_FIELD[field];

/**
 * The upper bound of a field, or `undefined` when the field is a fixed value.
 *
 * A stored upper bound is only honoured when it is a finite number strictly
 * greater than the lower bound. Anything else (missing, NaN, or an inverted
 * bound that slipped in through a hand-edited import) degrades to "no range" so
 * the set keeps behaving exactly like the fixed value it already is.
 */
export const getPlanRangeMax = (workoutSet: WorkoutSet | undefined, field: PlanRangeField): number | undefined => {
  if (workoutSet === undefined) {
    return undefined;
  }
  const max = workoutSet[MAX_FIELD_BY_FIELD[field]];
  const min = workoutSet[field];
  if (typeof max !== 'number' || !Number.isFinite(max) || !Number.isFinite(min)) {
    return undefined;
  }
  return max > min ? max : undefined;
};

export const hasPlanRange = (workoutSet: WorkoutSet | undefined, field: PlanRangeField): boolean =>
  getPlanRangeMax(workoutSet, field) !== undefined;

export const hasAnyPlanRange = (workoutSet: WorkoutSet | undefined): boolean =>
  PLAN_RANGE_FIELDS.some((field) => hasPlanRange(workoutSet, field));

/**
 * THE RULE. A range counts with its lower bound — which is the stored value.
 * Kept as an explicit function so no evaluation has to restate the convention.
 */
export const evaluationValue = (workoutSet: WorkoutSet, field: PlanRangeField): number => workoutSet[field];

export const evaluationReps = (workoutSet: WorkoutSet): number => evaluationValue(workoutSet, 'reps');

export const evaluationRir = (workoutSet: WorkoutSet): number => evaluationValue(workoutSet, 'rir');

export const evaluationWeight = (workoutSet: WorkoutSet): number => evaluationValue(workoutSet, 'weight');

/**
 * Strip the range bounds, leaving the exact set every evaluation sees. Returns
 * the identical reference for sets that carry no bounds at all.
 */
export const toEvaluationSet = (workoutSet: WorkoutSet): WorkoutSet => {
  if (workoutSet.repsMax === undefined && workoutSet.rirMax === undefined && workoutSet.weightMax === undefined) {
    return workoutSet;
  }
  const {repsMax: _repsMax, rirMax: _rirMax, weightMax: _weightMax, ...rest} = workoutSet;
  return {
    ...rest,
    reps: evaluationReps(workoutSet),
    rir: evaluationRir(workoutSet),
    weight: evaluationWeight(workoutSet),
  };
};

/** Format a number the way the plan screens do: no trailing zeroes. */
export const formatPlanNumber = (value: number): string => {
  if (Number.isInteger(value)) {
    return `${value}`;
  }
  return `${value}`.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

/** `"8"` for a fixed value, `"8-12"` for a range. */
export const formatPlanFieldValue = (workoutSet: WorkoutSet, field: PlanRangeField): string => {
  const max = getPlanRangeMax(workoutSet, field);
  const min = formatPlanNumber(workoutSet[field]);
  return max === undefined ? min : `${min}-${formatPlanNumber(max)}`;
};

/** `"8-12 reps · RIR 1-3 · 100-110 kg"` — the readable target of a planned set. */
export const describePlannedSet = (workoutSet: WorkoutSet): string =>
  [
    `${formatPlanFieldValue(workoutSet, 'reps')} ${UNIT_LABEL.reps}`,
    `${UNIT_LABEL.rir} ${formatPlanFieldValue(workoutSet, 'rir')}`,
    `${formatPlanFieldValue(workoutSet, 'weight')} ${UNIT_LABEL.weight}`,
  ].join(' · ');

/**
 * Set or clear the upper bound of one field. Passing `undefined` resets the
 * field back to a fixed value and removes the key entirely, so a set without
 * ranges serialises exactly as it did before GH-63.
 */
export const withPlanRangeMax = (workoutSet: WorkoutSet, field: PlanRangeField, max: number | undefined): WorkoutSet => {
  const maxField = MAX_FIELD_BY_FIELD[field];
  if (max === undefined) {
    if (workoutSet[maxField] === undefined) {
      return workoutSet;
    }
    const next = {...workoutSet};
    delete next[maxField];
    return next;
  }
  return {...workoutSet, [maxField]: max};
};
