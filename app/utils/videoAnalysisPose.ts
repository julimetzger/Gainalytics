import {BarTrackingResult, PoseJointPoint, PoseSample, PoseSide, PoseSideSample} from '../models/entities/VideoAnalysis';

/**
 * Hip/knee pose overlay (GH-75).
 *
 * The native analysis stores hip and knee (left + right, MediaPipe landmarks 23–26) for every
 * sampled frame in `result.poseSeries`. Playback never runs the model: it only draws these
 * stored points, interpolated between samples. The native player view does the per-frame
 * lookup with the same rule as `interpolatePoseJointAt` below.
 */

export type PoseJoint = 'hip' | 'knee';

/** A point below this visibility is hidden instead of drawn (MediaPipe's own cut-off). */
export const POSE_VISIBILITY_THRESHOLD = 0.5;
/** Both sides are drawn only if each is at least this visible on average… */
export const POSE_BOTH_SIDES_MIN_VISIBILITY = 0.8;
/** …and their averages are this close; otherwise only the side facing the camera. */
export const POSE_BOTH_SIDES_MAX_DIFFERENCE = 0.1;
/** Never interpolate across a gap shorter than this (ms), whatever the sample rate. */
export const POSE_MIN_MAX_GAP_MS = 100;
/** A gap of more than this many sample intervals hides the point instead of bridging it. */
export const POSE_MAX_GAP_INTERVALS = 2.5;

const POSE_SIDES: PoseSide[] = ['left', 'right'];

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const parseJointPoint = (raw: unknown): PoseJointPoint | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const {x, y, visibility} = raw as Record<string, unknown>;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(visibility)) {
    return undefined;
  }
  return {x, y, visibility: Math.min(1, Math.max(0, visibility))};
};

const parseSideSample = (raw: unknown): PoseSideSample | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const hip = parseJointPoint(record.hip);
  const knee = parseJointPoint(record.knee);
  if (!hip && !knee) {
    return undefined;
  }
  return {...(hip ? {hip} : {}), ...(knee ? {knee} : {})};
};

/**
 * Validates the stored pose series. Malformed samples or points are dropped; a missing series
 * or one that is not an array returns `undefined`, so the player shows no overlay.
 */
export const parsePoseSeries = (raw: unknown): PoseSample[] | undefined => {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const samples: PoseSample[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (!isFiniteNumber(record.tMs)) {
      continue;
    }
    const left = parseSideSample(record.left);
    const right = parseSideSample(record.right);
    samples.push({tMs: record.tMs, ...(left ? {left} : {}), ...(right ? {right} : {})});
  }
  // A series without any detected person stays (the player then says "not detected"),
  // unlike a missing series (analysed before GH-75: no overlay, no hint).
  return samples.sort((a, b) => a.tMs - b.tMs);
};

/**
 * Brings a stored result to the current shape. Results analysed before GH-75 have no
 * `poseSeries` and load unchanged; an unusable series is removed.
 */
export const normalizeBarTrackingResult = (raw: BarTrackingResult): BarTrackingResult => {
  if (!raw || typeof raw !== 'object' || !('poseSeries' in raw)) {
    return raw;
  }
  const poseSeries = parsePoseSeries((raw as {poseSeries?: unknown}).poseSeries);
  if (poseSeries) {
    return {...raw, poseSeries};
  }
  const {poseSeries: _dropped, ...rest} = raw;
  return rest;
};

const sideVisibility = (sample: PoseSample, side: PoseSide): number => {
  const sideSample = sample[side];
  return ((sideSample?.hip?.visibility ?? 0) + (sideSample?.knee?.visibility ?? 0)) / 2;
};

export const averageSideVisibility = (series: PoseSample[], side: PoseSide): number => {
  if (series.length === 0) {
    return 0;
  }
  return series.reduce((sum, sample) => sum + sideVisibility(sample, side), 0) / series.length;
};

/**
 * Picks the side(s) to draw: the side facing the camera (higher average visibility), or both
 * when both are clearly visible. Returns `[]` when neither side is visible enough.
 */
export const selectPoseSides = (series: PoseSample[] | undefined): PoseSide[] => {
  if (!series || series.length === 0) {
    return [];
  }
  const left = averageSideVisibility(series, 'left');
  const right = averageSideVisibility(series, 'right');
  if (
    left >= POSE_BOTH_SIDES_MIN_VISIBILITY &&
    right >= POSE_BOTH_SIDES_MIN_VISIBILITY &&
    Math.abs(left - right) <= POSE_BOTH_SIDES_MAX_DIFFERENCE
  ) {
    return ['left', 'right'];
  }
  const best = left >= right ? 'left' : 'right';
  return Math.max(left, right) >= POSE_VISIBILITY_THRESHOLD ? [best] : [];
};

/** Largest sample gap that is still bridged: 2.5 median sample intervals, at least 100 ms. */
export const getPoseMaxGapMs = (series: PoseSample[]): number => {
  const intervals: number[] = [];
  for (let index = 1; index < series.length; index += 1) {
    const interval = series[index].tMs - series[index - 1].tMs;
    if (interval > 0) {
      intervals.push(interval);
    }
  }
  if (intervals.length === 0) {
    return POSE_MIN_MAX_GAP_MS;
  }
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  return Math.max(POSE_MIN_MAX_GAP_MS, Math.round(median * POSE_MAX_GAP_INTERVALS));
};

const visiblePoint = (sample: PoseSample, side: PoseSide, joint: PoseJoint) => {
  const point = sample[side]?.[joint];
  return point && point.visibility >= POSE_VISIBILITY_THRESHOLD ? point : undefined;
};

/**
 * Position of one joint at `timeMs`, linearly interpolated between the two surrounding samples.
 * Returns `undefined` (point hidden) when either neighbour is missing or below the visibility
 * threshold, or when the neighbours are more than `maxGapMs` apart — so a point never jumps
 * across frames where the model lost it. Before the first / after the last sample the edge
 * sample is held for half a gap.
 */
export const interpolatePoseJointAt = (
  series: PoseSample[],
  side: PoseSide,
  joint: PoseJoint,
  timeMs: number,
  maxGapMs: number,
): {x: number; y: number} | undefined => {
  if (series.length === 0 || !Number.isFinite(timeMs)) {
    return undefined;
  }
  const first = series[0];
  const last = series[series.length - 1];
  if (timeMs <= first.tMs || timeMs >= last.tMs) {
    const edge = timeMs <= first.tMs ? first : last;
    const point = Math.abs(timeMs - edge.tMs) <= maxGapMs / 2 ? visiblePoint(edge, side, joint) : undefined;
    return point ? {x: point.x, y: point.y} : undefined;
  }

  // Binary search for the last sample at or before timeMs.
  let low = 0;
  let high = series.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (series[middle].tMs <= timeMs) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const before = series[low];
  const after = series[high];
  const from = visiblePoint(before, side, joint);
  if (from && timeMs === before.tMs) {
    return {x: from.x, y: from.y};
  }
  const to = visiblePoint(after, side, joint);
  if (!from || !to || after.tMs - before.tMs > maxGapMs) {
    return undefined;
  }
  const span = after.tMs - before.tMs;
  const ratio = span <= 0 ? 0 : (timeMs - before.tMs) / span;
  return {x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio};
};

export interface PoseOverlaySample {
  tMs: number;
  hipX?: number;
  hipY?: number;
  kneeX?: number;
  kneeY?: number;
}

export interface PoseOverlayTrack {
  side: PoseSide;
  samples: PoseOverlaySample[];
}

/**
 * Flattens the chosen side(s) for the native player overlay. Points below the visibility
 * threshold are left out, so the native lookup (same rule as `interpolatePoseJointAt`) hides them.
 */
export const buildPoseOverlayTracks = (series: PoseSample[] | undefined, sides: PoseSide[]): PoseOverlayTrack[] => {
  if (!series || series.length === 0) {
    return [];
  }
  return POSE_SIDES.filter((side) => sides.includes(side)).map((side) => ({
    side,
    samples: series.map((sample) => {
      const hip = visiblePoint(sample, side, 'hip');
      const knee = visiblePoint(sample, side, 'knee');
      return {
        tMs: sample.tMs,
        ...(hip ? {hipX: hip.x, hipY: hip.y} : {}),
        ...(knee ? {kneeX: knee.x, kneeY: knee.y} : {}),
      };
    }),
  }));
};

export const describePoseSides = (sides: PoseSide[]): string => {
  if (sides.length === 2) {
    return 'both sides';
  }
  return sides.length === 1 ? `${sides[0]} side` : 'not visible';
};
