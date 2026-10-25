/**
 * GH-528: Health Connect exercise segment types Gainalytics writes for an exercise. The keys are
 * understood by the native module (HealthConnectModule.segmentTypeOf); all of them are allowed
 * inside a STRENGTH_TRAINING session.
 */
export type HealthConnectSegmentKey =
  | 'SQUAT'
  | 'BENCH_PRESS'
  | 'DEADLIFT'
  | 'BARBELL_SHOULDER_PRESS'
  | 'SHOULDER_PRESS'
  | 'LAT_PULL_DOWN'
  | 'PULL_UP'
  | 'DUMBBELL_ROW'
  | 'LEG_PRESS'
  | 'LEG_CURL'
  | 'LEG_EXTENSION'
  | 'LUNGE'
  | 'HIP_THRUST'
  | 'ARM_CURL'
  | 'LATERAL_RAISE'
  | 'BACK_EXTENSION'
  | 'CRUNCH'
  | 'PLANK'
  | 'LEG_RAISE'
  | 'KETTLEBELL_SWING'
  | 'WEIGHTLIFTING';

/** Display names in the order the exercise editor offers them. */
export const HEALTH_CONNECT_SEGMENT_LABELS: Record<HealthConnectSegmentKey, string> = {
  SQUAT: 'Squat',
  BENCH_PRESS: 'Bench press',
  DEADLIFT: 'Deadlift',
  BARBELL_SHOULDER_PRESS: 'Barbell shoulder press',
  SHOULDER_PRESS: 'Shoulder press',
  LAT_PULL_DOWN: 'Lat pull-down',
  PULL_UP: 'Pull-up',
  DUMBBELL_ROW: 'Dumbbell row',
  LEG_PRESS: 'Leg press',
  LEG_CURL: 'Leg curl',
  LEG_EXTENSION: 'Leg extension',
  LUNGE: 'Lunge',
  HIP_THRUST: 'Hip thrust',
  ARM_CURL: 'Arm curl',
  LATERAL_RAISE: 'Lateral raise',
  BACK_EXTENSION: 'Back extension',
  CRUNCH: 'Crunch',
  PLANK: 'Plank',
  LEG_RAISE: 'Leg raise',
  KETTLEBELL_SWING: 'Kettlebell swing',
  WEIGHTLIFTING: 'Weightlifting (generic)',
};

export const HEALTH_CONNECT_SEGMENT_KEYS = Object.keys(HEALTH_CONNECT_SEGMENT_LABELS) as HealthConnectSegmentKey[];
