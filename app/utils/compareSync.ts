import {RepSegment} from '../models/entities/VideoAnalysis';

/**
 * Pure helpers for the Compare Analyses synchronized-playback timeline.
 *
 * The shared timeline is defined as video A's time domain: timeline t maps to
 * video A at time t and to video B at time t + offsetB. offsetB aligns both
 * videos on rep 1 lift-off (auto mode) or is user-adjusted (manual mode).
 */

export const clampMs = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Offset that aligns video B's first rep lift-off with video A's:
 * videoBTime = timelineTime + offset. Positive offset means B has a longer
 * lead-in than A (B's rep 1 starts later in its own video).
 */
export const computeAutoOffsetMs = (
  repSegmentsA: RepSegment[] | undefined,
  repSegmentsB: RepSegment[] | undefined,
): number => {
  const firstA = repSegmentsA?.[0];
  const firstB = repSegmentsB?.[0];
  if (!firstA || !firstB) {
    return 0;
  }
  return firstB.startMs - firstA.startMs;
};

/**
 * The timeline must cover video A fully and the part of video B that maps
 * into timeline space (B's own duration minus the offset shift).
 */
export const computeTimelineDurationMs = (
  durationAMs: number,
  durationBMs: number,
  offsetBMs: number,
): number => Math.max(1, durationAMs, durationBMs - offsetBMs);

export const mapTimelineToVideoTimes = (
  timelineMs: number,
  offsetBMs: number,
  durationAMs: number,
  durationBMs: number,
): {aMs: number; bMs: number} => ({
  aMs: clampMs(timelineMs, 0, Math.max(0, durationAMs)),
  bMs: clampMs(timelineMs + offsetBMs, 0, Math.max(0, durationBMs)),
});

/** Fractions [0..1] along the timeline where video A's reps start (scrubber tick marks). */
export const computeRepTickFractions = (
  repSegments: RepSegment[] | undefined,
  timelineDurationMs: number,
): number[] => {
  if (!repSegments || timelineDurationMs <= 0) {
    return [];
  }
  return repSegments
    .map((segment) => segment.startMs / timelineDurationMs)
    .filter((fraction) => fraction >= 0 && fraction <= 1);
};

/** m:ss.d — matches the compare-screen mockup (e.g. "0:00.0", "0:12.0", "1:01.2"). */
export const formatTimelineTime = (timeMs: number): string => {
  const totalTenths = Math.floor(Math.max(0, timeMs) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
};

/** Subtitle for the Rep Sync card describing the automatic rep-1 alignment. */
export const formatRepSyncSubtitle = (autoOffsetMs: number): string => {
  if (autoOffsetMs === 0) {
    return 'Aligned on rep 1 lift-off';
  }
  const seconds = (Math.abs(autoOffsetMs) / 1000).toFixed(2);
  const laggingVideo = autoOffsetMs > 0 ? 'B' : 'A';
  return `Aligned on rep 1 lift-off — ${laggingVideo} lead-in −${seconds}s removed`;
};

/** Signed seconds label for the manual offset regulator (e.g. "+0.15s", "−5.05s"). */
export const formatOffsetLabel = (offsetMs: number): string => {
  const seconds = (Math.abs(offsetMs) / 1000).toFixed(2);
  const sign = offsetMs < 0 ? '−' : '+';
  return `${sign}${seconds}s`;
};

/**
 * Timeline position of the previous rep start, or null when there is none.
 * A 300 ms grace window makes "previous" jump to the current rep's start
 * first, and only to the rep before it when already at a rep start.
 */
export const findPrevRepStartMs = (
  repSegments: RepSegment[] | undefined,
  timelineMs: number,
): number | null => {
  if (!repSegments) {
    return null;
  }
  let candidate: number | null = null;
  for (const segment of repSegments) {
    if (segment.startMs < timelineMs - 300) {
      candidate = segment.startMs;
    } else {
      break;
    }
  }
  return candidate;
};

/** Timeline position of the next rep start, or null when there is none. */
export const findNextRepStartMs = (
  repSegments: RepSegment[] | undefined,
  timelineMs: number,
): number | null => {
  if (!repSegments) {
    return null;
  }
  for (const segment of repSegments) {
    if (segment.startMs > timelineMs + 50) {
      return segment.startMs;
    }
  }
  return null;
};

// Same display rule as the Video Analysis Detail speed label: 1 decimal for
// values exactly representable with 1 decimal, otherwise 2 decimals (0.75).
export const formatSpeedLabel = (speed: number): string => {
  if (Number(speed.toFixed(1)) === speed) {
    return speed.toFixed(1);
  }
  return speed.toFixed(2);
};
