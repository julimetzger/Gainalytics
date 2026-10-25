import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {Exercise} from '../../../models/entities/Exercise';
import {PlanRangeMaxField} from '../../../utils/planRange';

// GH-418: the former 'quickEdit' mode (one cell editable inside the read view) is
// gone — every edit opens the full edit mode, so the user is never left in a
// half-read, half-edit view.
export type PlanMode = 'read' | 'fullEdit';

export type PlanField = 'reps' | 'rir' | 'weight';

// GH-63: the full-edit rows also drive the optional upper bound of each field.
export type PlanDraftField = PlanField | PlanRangeMaxField;

/** GH-418: the read-view cell the user tapped — focused when full edit opens. */
export interface PlanCellTarget {
  exerciseId: number;
  setIndex: number;
  field: PlanField;
}

export interface PlanChromeState {
  mode: PlanMode;
  exitToRead: () => void;
  handleBack: () => boolean;
}

export interface PlanSetDraft {
  reps: string;
  rir: string;
  weight: string;
  // GH-63: empty string means "no range" — the field stays a fixed value.
  repsMax: string;
  rirMax: string;
  weightMax: string;
}

export interface PendingPlanSet extends PlanSetDraft {
  index: number;
  // GH-406: true when the row was prefilled from the previous set of the same
  // exercise. Such a weight is a deliberate plan value, so the row starts with
  // the 1RM auto-suggestion switched off instead of overwriting it.
  prefilledFromPreviousSet?: boolean;
}

export type PendingPlanSetByExerciseId = Record<number, PendingPlanSet | undefined>;

export interface FullEditSnapshot {
  chosenExerciseId?: number;
  exercises: Exercise[];
  setsByExerciseId: Record<number, WorkoutSet[]>;
}
