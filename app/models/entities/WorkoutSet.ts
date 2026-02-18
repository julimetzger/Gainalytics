import {Record} from './Exercise';

export interface WorkoutSet {
  index?: number;
  rir: number;
  reps: number;
  weight: number;
  date?: Date;
  record?: Record[];
}

