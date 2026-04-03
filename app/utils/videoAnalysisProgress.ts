/**
 * videoAnalysisProgress.ts
 *
 * Utilities for:
 *  1. Duration-based progress calculation for the video analysis loading bar.
 *  2. Learning the expected analysis speed from completed runs.
 *  3. Foreground-service reference counting — ensures the service is only
 *     stopped once all concurrent analyses have finished.
 */

// ---------------------------------------------------------------------------
// Progress calculation
// ---------------------------------------------------------------------------

/**
 * Calculate analysis progress as a 0–1 fraction.
 *
 * The bar is driven by elapsed time relative to an estimated total duration.
 * The value is capped at MAX_REPORTED_PROGRESS so the bar never reaches 1.0
 * until the analysis result is confirmed (i.e. status transitions to DONE).
 *
 * @param elapsedMs    Milliseconds elapsed since the analysis started.
 * @param estimatedMs  Estimated total analysis time in ms (from estimateAnalysisTimeMs).
 *                     Pass 0 when unknown — returns 0 in that case.
 * @returns Progress fraction in [0, MAX_REPORTED_PROGRESS].
 */
export const MAX_REPORTED_PROGRESS = 0.95;
export const DEFAULT_ANALYSIS_SECONDS_PER_VIDEO_SECOND = 1;

let _lastAnalysisSecondsPerVideoSecond = DEFAULT_ANALYSIS_SECONDS_PER_VIDEO_SECOND;

export function calculateAnalysisProgress(elapsedMs: number, estimatedMs: number): number {
  if (estimatedMs <= 0 || elapsedMs < 0) {
    return 0;
  }
  const raw = elapsedMs / estimatedMs;
  return Math.min(raw, MAX_REPORTED_PROGRESS);
}

/**
 * Returns the learned analysis speed used for future duration estimates.
 * Defaults to 1 second of analysis per 1 second of video until the first
 * successful analysis completes.
 */
export function getLastAnalysisSecondsPerVideoSecond(): number {
  return _lastAnalysisSecondsPerVideoSecond;
}

/**
 * Learns a new seconds-per-video-second ratio from a completed analysis.
 * Invalid inputs leave the previous learned value unchanged.
 */
export function recordCompletedAnalysisRate(totalAnalysisMs: number, videoDurationMs: number): number {
  if (totalAnalysisMs <= 0 || videoDurationMs <= 0) {
    return _lastAnalysisSecondsPerVideoSecond;
  }

  _lastAnalysisSecondsPerVideoSecond = totalAnalysisMs / videoDurationMs;
  return _lastAnalysisSecondsPerVideoSecond;
}

// ---------------------------------------------------------------------------
// Foreground-service reference counting (ANA-005-fix issue 3)
//
// The foreground service must only be stopped when *no* analysis is still
// running. A simple counter prevents a completing analysis from tearing down
// the service while sibling analyses are still in progress.
// ---------------------------------------------------------------------------

let _activeAnalysisCount = 0;

/** Increment the count of in-flight analyses. Call when an analysis starts. */
export function incrementActiveAnalysisCount(): void {
  _activeAnalysisCount++;
}

/**
 * Decrement the count of in-flight analyses.
 * Call when an analysis finishes (success or failure).
 * The count never goes below 0.
 */
export function decrementActiveAnalysisCount(): void {
  _activeAnalysisCount = Math.max(0, _activeAnalysisCount - 1);
}

/** Returns the current number of in-flight analyses. */
export function getActiveAnalysisCount(): number {
  return _activeAnalysisCount;
}

/**
 * Returns true when the foreground service may be stopped safely,
 * i.e. when no analysis is still running.
 */
export function shouldStopForegroundService(): boolean {
  return _activeAnalysisCount === 0;
}

/** Reset the counter — intended for use in tests only. */
export function _resetActiveAnalysisCountForTesting(): void {
  _activeAnalysisCount = 0;
}

export function _resetLastAnalysisSecondsPerVideoSecondForTesting(): void {
  _lastAnalysisSecondsPerVideoSecond = DEFAULT_ANALYSIS_SECONDS_PER_VIDEO_SECOND;
}
