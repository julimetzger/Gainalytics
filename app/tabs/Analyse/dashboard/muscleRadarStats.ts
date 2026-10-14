import {Muscles} from '../../../models/Muscles';
import {Metric} from '../../../models/Metric';
import {Comparison} from '../../../components/analyse/MetricsOverviewForWorkouts';

export type RadarMetric = Metric.SETS | Metric.VOLUME;

/** Axis order of the radar: `Muscles` enum order, starting at 12 o'clock, clockwise. */
export const RADAR_MUSCLES = Object.values(Muscles);

const PUSH_MUSCLES = [Muscles.CHEST, Muscles.SHOULDERS, Muscles.TRICEPS];
const PULL_MUSCLES = [Muscles.BACK, Muscles.BICEPS];

export interface MuscleWeekValues {
  muscle: Muscles;
  sets: number;
  lastSets: number;
  /** kg */
  volume: number;
  /** kg */
  lastVolume: number;
}

export interface MuscleStat {
  muscle: Muscles;
  sets: number;
}

export interface PushPullStat {
  push: number;
  pull: number;
  /** push / pull, undefined when there is no pull volume to divide by */
  ratio: number | undefined;
}

export interface MuscleRadarStats {
  mostTrained: MuscleStat | undefined;
  lagging: MuscleStat | undefined;
  pushPull: PushPullStat | undefined;
}

// `difference` is only set when there was a last week to compare against —
// without one the last-week value is 0.
const lastWeekValue = (comparison: Comparison | undefined): number => {
  if (!comparison || comparison.difference === undefined) return 0;
  return Math.max(0, comparison.value - comparison.difference);
};

/** This-week and last-week sets/volume per muscle; muscles missing in the map count as 0. */
export const buildMuscleWeekValues = (muscleMetricMap: Map<Muscles, Map<Metric, Comparison>>): MuscleWeekValues[] =>
  RADAR_MUSCLES.map((muscle) => {
    const metrics = muscleMetricMap.get(muscle);
    const sets = metrics?.get(Metric.SETS);
    const volume = metrics?.get(Metric.VOLUME);
    return {
      muscle,
      sets: sets?.value ?? 0,
      lastSets: lastWeekValue(sets),
      volume: volume?.value ?? 0,
      lastVolume: lastWeekValue(volume),
    };
  });

export const currentValue = (values: MuscleWeekValues, metric: RadarMetric) => (metric === Metric.SETS ? values.sets : values.volume);
export const lastValue = (values: MuscleWeekValues, metric: RadarMetric) => (metric === Metric.SETS ? values.lastSets : values.lastVolume);

/** Smallest "nice" number (1, 2, 2.5, 5 × 10ⁿ) that is ≥ `value`; 1 for an empty chart. */
export const niceMax = (value: number): number => {
  if (!(value > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= value - 1e-9) ?? 10;
  return step * magnitude;
};

/** Sets are muscle-share weighted and can be fractional: `14`, `4.5`. */
export const formatSets = (sets: number): string => {
  const rounded = Math.round(sets * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
};

/** kg → `6.2t` */
export const formatTonnes = (kg: number): string => `${(kg / 1000).toFixed(1)}t`;

export const formatMetricValue = (value: number, metric: RadarMetric): string => (metric === Metric.SETS ? formatSets(value) : formatTonnes(value));

/** `+2 sets` / `-1.7t` / `0 sets` */
export const formatDelta = (delta: number, metric: RadarMetric): string => {
  const formatted = metric === Metric.SETS ? `${formatSets(Math.abs(delta))} sets` : formatTonnes(Math.abs(delta));
  const isZero = formatted === '0 sets' || formatted === '0.0t';
  if (isZero) return formatted;
  return `${delta > 0 ? '+' : '-'}${formatted}`;
};

export const calculateMuscleRadarStats = (values: MuscleWeekValues[]): MuscleRadarStats => {
  const trained = values.filter((value) => value.sets > 0);
  if (trained.length === 0) {
    return {mostTrained: undefined, lagging: undefined, pushPull: undefined};
  }

  // Ties go to the first muscle in axis order.
  const mostTrained = values.reduce((best, value) => (value.sets > best.sets ? value : best));
  const lagging = values.reduce((worst, value) => (value.sets < worst.sets ? value : worst));

  const setsOf = (muscles: Muscles[]) => values.filter((value) => muscles.includes(value.muscle)).reduce((acc, value) => acc + value.sets, 0);
  const push = setsOf(PUSH_MUSCLES);
  const pull = setsOf(PULL_MUSCLES);

  return {
    mostTrained: {muscle: mostTrained.muscle, sets: mostTrained.sets},
    lagging: {muscle: lagging.muscle, sets: lagging.sets},
    pushPull: push === 0 && pull === 0 ? undefined : {push, pull, ratio: pull > 0 ? push / pull : undefined},
  };
};
