import {Muscles} from '../Muscles';
import {HealthConnectSegmentKey} from '../HealthConnectSegmentType';

export type Exercise = {
  id?: number;
  name: string;
  isFocus?: boolean;
  muscles?: MusclePercentPair[];
  alternativeIds?: number[];
  records?: {
    [recordAsString: string]: ExerciseRecord[];
  };
  /**
   * VL reference for this exercise: the one set whose confirmed RIR anchors the
   * velocity-loss → RIR curve. At most one is active; setting a new one replaces it.
   *
   * Not to be confused with a video analysis' `calibratedAt`, which means the user
   * confirmed the detected reps of that set.
   */
  vlReference?: VelocityLossReference;
  /**
   * GH-528: Health Connect segment type chosen by the user. Overrides the name-based rule
   * (healthConnectMapping.segmentTypeForExercise); `undefined` means "automatic".
   */
  healthConnectType?: HealthConnectSegmentKey;
};

/**
 * A single set that anchors an exercise's velocity-loss → RIR curve.
 * `velocityLossPercent` is the VL measured on that set, `rir` the RIR the athlete
 * confirmed for it. Together they scale the global thresholds for this exercise.
 */
export interface VelocityLossReference {
  /** Confirmed RIR of the reference set. Only 0–3 are valid anchors. */
  rir: number;
  /** Velocity loss (%) measured on the reference set. */
  velocityLossPercent: number;
  /** ISO timestamp of when the reference was set. */
  referencedAt: string;
  /** Video analysis the reference set was taken from. */
  analysisId: number;
  workoutId?: number;
  setIndex?: number;
}

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
