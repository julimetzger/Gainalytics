import {
  calculateAnalysisProgress,
  MAX_REPORTED_PROGRESS,
  incrementActiveAnalysisCount,
  decrementActiveAnalysisCount,
  getActiveAnalysisCount,
  shouldStopForegroundService,
  _resetActiveAnalysisCountForTesting,
} from '../videoAnalysisProgress';

// ---------------------------------------------------------------------------
// calculateAnalysisProgress
// ---------------------------------------------------------------------------
describe('calculateAnalysisProgress', () => {
  it('returns 0 when estimatedMs is 0 (unknown duration)', () => {
    expect(calculateAnalysisProgress(5000, 0)).toBe(0);
  });

  it('returns 0 when estimatedMs is negative', () => {
    expect(calculateAnalysisProgress(1000, -500)).toBe(0);
  });

  it('returns 0 when elapsedMs is 0', () => {
    expect(calculateAnalysisProgress(0, 10_000)).toBe(0);
  });

  it('returns 0 when elapsedMs is negative', () => {
    expect(calculateAnalysisProgress(-100, 10_000)).toBe(0);
  });

  it('returns fraction when elapsed < estimated (mid-progress)', () => {
    // 45s video, 1:1 rate → 45s estimated; after 22.5s we expect 0.5
    expect(calculateAnalysisProgress(22_500, 45_000)).toBeCloseTo(0.5);
  });

  it('caps at MAX_REPORTED_PROGRESS when elapsed >= estimated', () => {
    expect(calculateAnalysisProgress(45_000, 45_000)).toBe(MAX_REPORTED_PROGRESS);
    expect(calculateAnalysisProgress(90_000, 45_000)).toBe(MAX_REPORTED_PROGRESS);
  });

  it('MAX_REPORTED_PROGRESS is strictly less than 1', () => {
    expect(MAX_REPORTED_PROGRESS).toBeLessThan(1);
  });

  it('uses learned rate for a 45s video at 1:1 ratio: full bar after 45s', () => {
    // Initial estimate: 1s analysis per 1s video → 45_000ms
    const estimatedMs = 45_000;
    expect(calculateAnalysisProgress(45_000, estimatedMs)).toBe(MAX_REPORTED_PROGRESS);
  });

  it('uses learned rate faster than real-time correctly', () => {
    // After first run the device proved 0.5x real-time → estimated = 22_500ms
    const estimatedMs = 22_500;
    // At 11_250ms elapsed we expect 50% progress
    expect(calculateAnalysisProgress(11_250, estimatedMs)).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// Foreground service reference counting (ANA-005-fix issue 3)
// ---------------------------------------------------------------------------
describe('foreground service reference counting', () => {
  beforeEach(() => {
    _resetActiveAnalysisCountForTesting();
  });

  it('starts at 0 active analyses', () => {
    expect(getActiveAnalysisCount()).toBe(0);
  });

  it('increments count when an analysis starts', () => {
    incrementActiveAnalysisCount();
    expect(getActiveAnalysisCount()).toBe(1);
  });

  it('decrements count when an analysis finishes', () => {
    incrementActiveAnalysisCount();
    incrementActiveAnalysisCount();
    decrementActiveAnalysisCount();
    expect(getActiveAnalysisCount()).toBe(1);
  });

  it('never goes below 0', () => {
    decrementActiveAnalysisCount();
    expect(getActiveAnalysisCount()).toBe(0);
  });

  it('shouldStopForegroundService returns true when no analyses are running', () => {
    expect(shouldStopForegroundService()).toBe(true);
  });

  it('shouldStopForegroundService returns false while an analysis is running', () => {
    incrementActiveAnalysisCount();
    expect(shouldStopForegroundService()).toBe(false);
  });

  it('shouldStopForegroundService returns true again once all analyses finish', () => {
    incrementActiveAnalysisCount();
    incrementActiveAnalysisCount();
    decrementActiveAnalysisCount();
    expect(shouldStopForegroundService()).toBe(false);
    decrementActiveAnalysisCount();
    expect(shouldStopForegroundService()).toBe(true);
  });

  it('service is not stopped while sibling analyses are still running', () => {
    // Simulate two concurrent analyses
    incrementActiveAnalysisCount(); // analysis A starts
    incrementActiveAnalysisCount(); // analysis B starts
    decrementActiveAnalysisCount(); // analysis A finishes
    // Service must NOT stop yet
    expect(shouldStopForegroundService()).toBe(false);
    decrementActiveAnalysisCount(); // analysis B finishes
    // Now both are done — service may stop
    expect(shouldStopForegroundService()).toBe(true);
  });
});
