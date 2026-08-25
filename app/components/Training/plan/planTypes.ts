import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {Exercise} from '../../../models/entities/Exercise';

export type PlanMode = 'read' | 'quickEdit' | 'fullEdit';

export type PlanField = 'reps' | 'rir' | 'weight';

export interface QuickEditTarget {
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
