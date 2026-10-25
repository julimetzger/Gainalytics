import {formatRelativeStrength, latestWeight, relativeStrength, weightAt, weightOriginName, WEIGHT_AFTER_TOLERANCE_MS} from '../../../app/utils/healthConnect/bodyWeight';
import {HealthConnectWeight} from '../../../app/utils/healthConnect/healthConnectNative';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 1);

const weight = (kg: number, day: number, origin = 'com.withings.wiscale2', originLabel = 'Withings Health Mate'): HealthConnectWeight => ({kg, time: T0 + day * DAY, origin, originLabel});

describe('GH-528 body weight helpers', () => {
  const weights = [weight(80, 0), weight(82, 30), weight(84, 60)];

  it('finds the newest measurement regardless of order', () => {
    expect(latestWeight([weights[2], weights[0], weights[1]])).toEqual(weight(84, 60));
    expect(latestWeight([])).toBeUndefined();
  });

  it('uses the latest measurement on or before a date', () => {
    expect(weightAt(weights, T0 + 45 * DAY)).toEqual(weight(82, 30));
    expect(weightAt(weights, T0 + 30 * DAY)).toEqual(weight(82, 30));
    expect(weightAt(weights, T0 + 400 * DAY)).toEqual(weight(84, 60));
  });

  it('falls back to a measurement shortly after a date older than the first weigh-in', () => {
    expect(weightAt(weights, T0 - 3 * DAY)).toEqual(weight(80, 0));
    expect(weightAt(weights, T0 - WEIGHT_AFTER_TOLERANCE_MS - 1)).toBeUndefined();
    expect(weightAt([], T0)).toBeUndefined();
  });

  it('computes 1RM / body weight rounded to two decimals', () => {
    expect(relativeStrength(150, 82)).toBe(1.83);
    expect(relativeStrength(150, undefined)).toBeUndefined();
    expect(relativeStrength(undefined, 82)).toBeUndefined();
    expect(relativeStrength(150, 0)).toBeUndefined();
    expect(formatRelativeStrength(1.8)).toBe('1.80 × BW');
  });

  it('names the app a value came from', () => {
    expect(weightOriginName(weight(80, 0))).toBe('Withings');
    expect(weightOriginName(weight(80, 0, 'com.example.scale', 'Example Scale'))).toBe('Example Scale');
    // Package visibility can hide the label: fall back to the package name.
    expect(weightOriginName(weight(80, 0, 'com.example.scale', 'com.example.scale'))).toBe('com.example.scale');
  });
});
