import {BarPathPoint, BarTrackingResult, VideoAnalysisRepResult, VideoAnalysisSetResult} from '../models/entities/VideoAnalysis';

/**
 * Pure, reusable set/rep velocity aggregation for video analyses.
 *
 * Mirrors the smoothing + concentric-phase velocity computation used when a
 * set result is calibrated and saved in VideoAnalysisPlaybackOverlayCard, so
 * the fallback values computed here for uncalibrated analyses match what a
 * later calibration would store. All velocities are in px/s; callers convert
 * to m/s with the analysis' metersPerPixel when available.
 */

const BAR_PATH_SMOOTHING_WINDOW = 5;
const SPEED_SMOOTHING_WINDOW = 5;

const smoothNumberSeries = (values: number[], windowSize: number): number[] => {
  if (values.length === 0 || windowSize <= 1) {
    return values;
  }
  const halfWindow = Math.floor(windowSize / 2);
  return values.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length - 1, index + halfWindow);
    let sum = 0;
    let count = 0;
    for (let cursor = start; cursor <= end; cursor += 1) {
      sum += values[cursor];
      count += 1;
    }
    return count > 0 ? sum / count : 0;
  });
};

export const smoothBarPathSeries = (barPathSeries: BarPathPoint[]): BarPathPoint[] => {
  if (barPathSeries.length < 3) {
    return barPathSeries;
  }
  const smoothedX = smoothNumberSeries(barPathSeries.map((point) => point.x), BAR_PATH_SMOOTHING_WINDOW);
  const smoothedY = smoothNumberSeries(barPathSeries.map((point) => point.y), BAR_PATH_SMOOTHING_WINDOW);
  return barPathSeries.map((point, index) => ({...point, x: smoothedX[index], y: smoothedY[index]}));
};

/**
 * Vertical velocity (px/s) per bar-path sample via central difference,
 * smoothed. Downward movement is negative, upward positive.
 */
export const calculateVerticalVelocitySeries = (barPathSeries: BarPathPoint[]): number[] => {
  if (barPathSeries.length === 0) {
    return [];
  }
  const raw = barPathSeries.map((_, index) => {
    const previous = barPathSeries[Math.max(0, index - 1)];
    const next = barPathSeries[Math.min(barPathSeries.length - 1, index + 1)];
    const deltaTimeMs = Math.max(1, next.tMs - previous.tMs);
    return (previous.y - next.y) / (deltaTimeMs / 1000);
  });
  return smoothNumberSeries(raw, SPEED_SMOOTHING_WINDOW);
};

const findNearestPointIndex = (barPathSeries: BarPathPoint[], timeMs: number): number | undefined => {
  if (barPathSeries.length === 0) {
    return undefined;
  }
  let nearestIndex = 0;
  let nearestDistance = Math.abs(timeMs - barPathSeries[0].tMs);
  for (let index = 1; index < barPathSeries.length; index += 1) {
    const distance = Math.abs(timeMs - barPathSeries[index].tMs);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }
  return nearestIndex;
};

/**
 * Squat/Bench/OHP are eccentric-first (TOP → BOTTOM → TOP), Deadlift is
 * concentric-first (BOTTOM → TOP → BOTTOM). Distinguished by the bar's
 * vertical motion between start and turnaround in tracking-frame coordinates
 * (larger y = lower physical position). Uses the RAW series: smoothing can
 * pull the start/turnaround samples toward the rep's mean and obscure the
 * physical direction.
 */
export const isConcentricFirstRep = (barPathSeries: BarPathPoint[], startMs: number, turnaroundMs: number): boolean => {
  if (barPathSeries.length === 0 || turnaroundMs <= startMs) {
    return false;
  }
  const startIdx = findNearestPointIndex(barPathSeries, startMs);
  const turnIdx = findNearestPointIndex(barPathSeries, turnaroundMs);
  if (startIdx === undefined || turnIdx === undefined) {
    return false;
  }
  return barPathSeries[startIdx].y > barPathSeries[turnIdx].y;
};

export interface RepPhaseWindow {
  concentricStartMs: number;
  concentricEndMs: number;
  eccentricStartMs: number;
  eccentricEndMs: number;
  concentricFirst: boolean;
}

export const getRepPhaseWindow = (
  barPathSeries: BarPathPoint[],
  startMs: number,
  turnaroundMs: number,
  endMs: number,
): RepPhaseWindow => {
  const concentricFirst = isConcentricFirstRep(barPathSeries, startMs, turnaroundMs);
  if (concentricFirst) {
    return {
      concentricStartMs: startMs,
      concentricEndMs: turnaroundMs,
      eccentricStartMs: turnaroundMs,
      eccentricEndMs: endMs,
      concentricFirst: true,
    };
  }
  return {
    eccentricStartMs: startMs,
    eccentricEndMs: turnaroundMs,
    concentricStartMs: turnaroundMs,
    concentricEndMs: endMs,
    concentricFirst: false,
  };
};

/**
 * Average and peak |velocity| (px/s) over [startMs, endMs] of a pre-smoothed
 * series/velocity pair. Same interval metric the detail screen saves as a
 * rep's vAvg/vPeak.
 */
export const computeIntervalVelocityMetrics = (
  smoothedSeries: BarPathPoint[],
  velocitySeries: number[],
  startMs: number,
  endMs: number,
): {vAvg: number; vPeak: number} | null => {
  if (startMs >= endMs || smoothedSeries.length === 0) {
    return null;
  }
  const velocities: number[] = [];
  for (let i = 0; i < smoothedSeries.length && i < velocitySeries.length; i++) {
    const t = smoothedSeries[i].tMs;
    if (t >= startMs && t <= endMs) {
      velocities.push(Math.abs(velocitySeries[i]));
    }
  }
  if (velocities.length === 0) {
    return null;
  }
  return {
    vPeak: Math.round(Math.max(...velocities)),
    vAvg: Math.round(velocities.reduce((sum, v) => sum + v, 0) / velocities.length),
  };
};

/**
 * Per-rep results computed from the raw tracking result. This is the fallback
 * for analyses without a calibrated/saved setResult: vAvg/vPeak come from the
 * concentric phase of each rep segment instead of being 0.
 */
export const computeRepResultsFromTracking = (result: BarTrackingResult): VideoAnalysisRepResult[] => {
  const smoothed = smoothBarPathSeries(result.barPathSeries);
  const velocity = calculateVerticalVelocitySeries(smoothed);
  return result.repSegments.map((seg, i) => {
    const phases = getRepPhaseWindow(result.barPathSeries, seg.startMs, seg.turnaroundMs, seg.endMs);
    const metrics = computeIntervalVelocityMetrics(smoothed, velocity, phases.concentricStartMs, phases.concentricEndMs);
    return {
      repIndex: seg.repIndex ?? i,
      startMs: seg.startMs,
      turnaroundMs: seg.turnaroundMs,
      endMs: seg.endMs,
      totalTimeMs: seg.endMs - seg.startMs,
      eccentricTimeMs: Math.max(0, phases.eccentricEndMs - phases.eccentricStartMs),
      concentricTimeMs: Math.max(0, phases.concentricEndMs - phases.concentricStartMs),
      vAvg: metrics?.vAvg ?? 0,
      vPeak: metrics?.vPeak ?? 0,
    };
  });
};

/**
 * Rep results for the compare screen: prefer the calibrated saved setResult,
 * otherwise compute real values from the tracking data (never all-zero rows).
 */
export const resolveCompareRepResults = (
  result: BarTrackingResult | undefined,
  savedSetResult: VideoAnalysisSetResult | undefined,
): VideoAnalysisRepResult[] => {
  if (savedSetResult?.repResults && savedSetResult.repResults.length > 0) {
    return savedSetResult.repResults;
  }
  if (!result) {
    return [];
  }
  return computeRepResultsFromTracking(result);
};

export interface SetVelocityAggregate {
  repCount: number;
  /** Mean of per-rep concentric vAvg (px/s), null when no rep has data. */
  meanVAvgPxPerS: number | null;
  /** Max of per-rep concentric vPeak (px/s), null when no rep has data. */
  peakVPeakPxPerS: number | null;
}

/** Aggregate per-rep velocities over ALL reps of a set. */
export const aggregateSetVelocity = (repResults: VideoAnalysisRepResult[]): SetVelocityAggregate => {
  const withData = repResults.filter((rep) => Number.isFinite(rep.vAvg) && rep.vAvg > 0);
  if (withData.length === 0) {
    return {repCount: repResults.length, meanVAvgPxPerS: null, peakVPeakPxPerS: null};
  }
  const meanVAvg = withData.reduce((sum, rep) => sum + rep.vAvg, 0) / withData.length;
  const peakVPeak = Math.max(...withData.map((rep) => rep.vPeak));
  return {
    repCount: repResults.length,
    meanVAvgPxPerS: meanVAvg,
    peakVPeakPxPerS: peakVPeak,
  };
};

export type VelocityUnit = 'px/s' | 'm/s';

/**
 * Display value for a px/s velocity: converted to m/s (3 decimals, like the
 * detail screen) when calibrated, whole px/s otherwise.
 */
export const formatVelocityValue = (pxPerS: number | null | undefined, metersPerPixel?: number): string => {
  if (pxPerS == null || !Number.isFinite(pxPerS)) {
    return '—';
  }
  if (metersPerPixel != null && metersPerPixel > 0) {
    return (pxPerS * metersPerPixel).toFixed(3);
  }
  return `${Math.round(pxPerS)}`;
};

export const velocityUnitFor = (metersPerPixel?: number): VelocityUnit =>
  metersPerPixel != null && metersPerPixel > 0 ? 'm/s' : 'px/s';

/**
 * Signed delta B − A in a shared unit. Comparable when both analyses are
 * calibrated (m/s) or neither is (px/s, same camera-space caveat as the
 * mockup); null when one side is calibrated and the other is not, or when
 * either value is missing.
 */
export const computeVelocityDelta = (
  aPxPerS: number | null | undefined,
  bPxPerS: number | null | undefined,
  metersPerPixelA?: number,
  metersPerPixelB?: number,
): {delta: number; unit: VelocityUnit} | null => {
  if (aPxPerS == null || bPxPerS == null || !Number.isFinite(aPxPerS) || !Number.isFinite(bPxPerS)) {
    return null;
  }
  const unitA = velocityUnitFor(metersPerPixelA);
  const unitB = velocityUnitFor(metersPerPixelB);
  if (unitA !== unitB) {
    return null;
  }
  if (unitA === 'm/s') {
    return {delta: bPxPerS * (metersPerPixelB as number) - aPxPerS * (metersPerPixelA as number), unit: 'm/s'};
  }
  return {delta: bPxPerS - aPxPerS, unit: 'px/s'};
};

/** "+0.017" / "−12" — sign always shown, decimals by unit. */
export const formatVelocityDelta = (delta: number, unit: VelocityUnit): string => {
  const value = unit === 'm/s' ? Math.abs(delta).toFixed(3) : `${Math.round(Math.abs(delta))}`;
  const sign = delta < 0 ? '−' : '+';
  return `${sign}${value}`;
};
