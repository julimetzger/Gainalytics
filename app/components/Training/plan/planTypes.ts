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
}

export type PendingPlanSetByExerciseId = Record<number, PendingPlanSet | undefined>;

export interface FullEditSnapshot {
  chosenExerciseId?: number;
  exercises: Exercise[];
  setsByExerciseId: Record<number, WorkoutSet[]>;
}
