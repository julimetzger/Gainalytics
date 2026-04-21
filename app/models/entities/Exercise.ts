import {Muscles} from '../Muscles';

export type Exercise = {
  id?: number;
  name: string;
  isFocus?: boolean;
  muscles?: MusclePercentPair[];
  alternativeIds?: number[];
  records?: {
    [recordAsString: string]: ExerciseRecord[];
  };
};

export interface ExerciseRecord {
  value: number;
  workoutId: number;
}

export interface MusclePercentPair {
  muscle?: Muscles;
  percent?: number;
}

export enum Record {
  ONE_RM = '1RM',
}
