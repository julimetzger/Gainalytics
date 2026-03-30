const DEFAULT_SECONDS_PER_VIDEO_SECOND = 1.0;

export const estimateAnalysisProgress = (
  analysisStartedAtMs: number,
  videoDurationMs: number,
  lastAnalysisSecondsPerVideoSecond: number | undefined,
  nowMs: number = Date.now(),
): {progress: number; estimatedRemainingMs: number} => {
  const rate = lastAnalysisSecondsPerVideoSecond ?? DEFAULT_SECONDS_PER_VIDEO_SECOND;
  const videoDurationS = videoDurationMs / 1000;
  const estimatedTotalMs = videoDurationS * rate * 1000;
  const elapsedMs = nowMs - analysisStartedAtMs;

  if (estimatedTotalMs <= 0) {
    return {progress: 0, estimatedRemainingMs: 0};
  }

  const progress = Math.min(elapsedMs / estimatedTotalMs, 0.99);
  const estimatedRemainingMs = Math.max(0, estimatedTotalMs - elapsedMs);

  return {progress, estimatedRemainingMs};
};

export const computeSecondsPerVideoSecond = (
  totalAnalysisMs: number,
  videoDurationMs: number,
): number => {
  if (videoDurationMs <= 0) {
    return DEFAULT_SECONDS_PER_VIDEO_SECOND;
  }
  return totalAnalysisMs / videoDurationMs;
};

export const formatRemainingTime = (remainingMs: number): string => {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};
