import {Record} from './Exercise';

export interface WorkoutSet {
  index?: number;
  rir: number;
  reps: number;
  weight: number;
  // GH-63: optional planning-only upper bounds ("rep ranges"). `undefined` means
  // the set is a fixed value and behaves exactly as before — there is no
  // migration and no default. reps/rir/weight always stay the LOWER bound of a
  // range, which is also the value every evaluation counts (see utils/planRange).
  // An actually executed set never carries these fields.
  repsMax?: number;
  rirMax?: number;
  weightMax?: number;
  date?: Date;
  record?: Record[];
}
