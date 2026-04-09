/**
 * Shared utility for Velocity Loss → RIR mapping and discrepancy detection.
 * Extracted from VideoAnalysisPlaybackOverlayCard (heuristic v1, issue #66).
 */

/**
 * Maps a velocity-loss percentage to a RIR estimate string.
 * Uses the same thresholds as VideoAnalysisPlaybackOverlayCard.
 */
export function vlToRirEstimate(velocityLossPercent: number): string {
  if (velocityLossPercent < 10) return '4+';
  if (velocityLossPercent < 20) return '3-4';
  if (velocityLossPercent < 30) return '2-3';
  if (velocityLossPercent < 40) return '1-2';
  return '0-1';
}

/**
 * Returns true if the reported RIR falls outside the VL-based RIR range.
 * A discrepancy indicates the athlete's perceived effort differs from the
 * velocity-derived effort estimate.
 */
export function hasRirDiscrepancy(reportedRir: number, velocityLossPercent: number): boolean {
  const estimate = vlToRirEstimate(velocityLossPercent);
  switch (estimate) {
    case '4+':
      return reportedRir < 4;
    case '3-4':
      return reportedRir < 3 || reportedRir > 4;
    case '2-3':
      return reportedRir < 2 || reportedRir > 3;
    case '1-2':
      return reportedRir < 1 || reportedRir > 2;
    case '0-1':
      return reportedRir < 0 || reportedRir > 1;
    default:
      return false;
  }
}
