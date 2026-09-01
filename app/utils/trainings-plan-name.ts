/**
 * GH-428 (H1): a plan name is required from now on, but plans created before
 * that validation existed may still carry an empty name. No migration cleans
 * them up, so every read path needs a stable fallback instead — otherwise a
 * legacy plan renders as an empty row, its edit dialog reads "Edit " and its
 * delete confirmation reads "Delete ".
 */
export const UNNAMED_TRAININGS_PLAN_LABEL = 'Unnamed plan';

/** Trimmed plan name, or the fallback label when the plan has no usable name. */
export const trainingsPlanDisplayName = (name?: string): string => {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : UNNAMED_TRAININGS_PLAN_LABEL;
};

/** True when the entered name is acceptable for saving a plan. */
export const isValidTrainingsPlanName = (name?: string): boolean => (name?.trim().length ?? 0) > 0;
