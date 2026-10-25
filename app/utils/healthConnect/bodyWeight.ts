/**
 * GH-528 (T3): body weight from Health Connect and relative strength (1RM / body weight).
 * Pure helpers; the weights are only held in memory (see healthConnectReducer).
 */
import {HealthConnectWeight} from './healthConnectNative';

/** A measurement taken after a 1RM still counts for it if it is at most this far away. */
export const WEIGHT_AFTER_TOLERANCE_MS = 14 * 24 * 60 * 60 * 1000;

const KNOWN_ORIGINS: {[packageName: string]: string} = {
  'com.withings.wiscale2': 'Withings',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.huawei.health': 'Huawei Health',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.renpho.health': 'Renpho Health',
  'com.powerliftingworkoutplanner': 'Gainalytics',
};

/** Name of the app that wrote a value, e.g. "Withings" for com.withings.wiscale2. */
export const weightOriginName = (weight: Pick<HealthConnectWeight, 'origin' | 'originLabel'>): string =>
  KNOWN_ORIGINS[weight.origin] ?? (weight.originLabel && weight.originLabel !== weight.origin ? weight.originLabel : weight.origin);

/** Newest measurement, regardless of the input order. */
export const latestWeight = (weights: HealthConnectWeight[]): HealthConnectWeight | undefined =>
  weights.reduce<HealthConnectWeight | undefined>((latest, weight) => (latest === undefined || weight.time > latest.time ? weight : latest), undefined);

/**
 * Body weight "at" a point in time: the latest measurement on or before it. If there is none
 * (the 1RM is older than the first weigh-in), the first measurement within
 * WEIGHT_AFTER_TOLERANCE_MS afterwards; otherwise none.
 */
export const weightAt = (weights: HealthConnectWeight[], timeMs: number): HealthConnectWeight | undefined => {
  let before: HealthConnectWeight | undefined;
  let after: HealthConnectWeight | undefined;
  weights.forEach((weight) => {
    if (weight.time <= timeMs) {
      if (before === undefined || weight.time > before.time) before = weight;
    } else if (weight.time - timeMs <= WEIGHT_AFTER_TOLERANCE_MS && (after === undefined || weight.time < after.time)) {
      after = weight;
    }
  });
  return before ?? after;
};

/** 1RM divided by body weight, e.g. 1.85 (× body weight); undefined without a usable weight. */
export const relativeStrength = (oneRmKg: number | undefined, bodyWeightKg: number | undefined): number | undefined => {
  if (oneRmKg === undefined || bodyWeightKg === undefined || !Number.isFinite(oneRmKg) || !(bodyWeightKg > 0)) return undefined;
  return Math.round((oneRmKg / bodyWeightKg) * 100) / 100;
};

export const formatRelativeStrength = (ratio: number) => `${ratio.toFixed(2)} × BW`;
