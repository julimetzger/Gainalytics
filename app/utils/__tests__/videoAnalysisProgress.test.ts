import {estimateAnalysisProgress, computeSecondsPerVideoSecond, formatRemainingTime} from '../videoAnalysisProgress';

describe('estimateAnalysisProgress', () => {
  it('should return 0 progress at the start', () => {
    const now = 1000;
    const result = estimateAnalysisProgress(1000, 6000, 1.0, now);
    expect(result.progress).toBe(0);
    expect(result.estimatedRemainingMs).toBe(6000);
  });

  it('should return ~50% progress halfway through estimated time', () => {
    const startMs = 1000;
    const videoDurationMs = 10000; // 10s video
    const rate = 1.0; // 1s analysis per 1s video → 10s total
    const now = startMs + 5000; // 5s elapsed

    const result = estimateAnalysisProgress(startMs, videoDurationMs, rate, now);
    expect(result.progress).toBeCloseTo(0.5, 2);
    expect(result.estimatedRemainingMs).toBe(5000);
  });

  it('should cap progress at 0.99', () => {
    const startMs = 1000;
    const videoDurationMs = 5000;
    const rate = 1.0; // 5s total
    const now = startMs + 20000; // way past estimated time

    const result = estimateAnalysisProgress(startMs, videoDurationMs, rate, now);
    expect(result.progress).toBe(0.99);
    expect(result.estimatedRemainingMs).toBe(0);
  });

  it('should use default rate of 1.0 when lastRate is undefined', () => {
    const startMs = 0;
    const videoDurationMs = 4000; // 4s video
    const now = 2000; // 2s elapsed, default rate=1.0 → total=4s

    const result = estimateAnalysisProgress(startMs, videoDurationMs, undefined, now);
    expect(result.progress).toBeCloseTo(0.5, 2);
    expect(result.estimatedRemainingMs).toBe(2000);
  });

  it('should handle rate faster than 1:1', () => {
    const startMs = 0;
    const videoDurationMs = 10000; // 10s video
    const rate = 0.5; // 0.5s analysis per 1s video → 5s total
    const now = 2500; // 2.5s elapsed

    const result = estimateAnalysisProgress(startMs, videoDurationMs, rate, now);
    expect(result.progress).toBeCloseTo(0.5, 2);
    expect(result.estimatedRemainingMs).toBe(2500);
  });

  it('should handle rate slower than 1:1', () => {
    const startMs = 0;
    const videoDurationMs = 6000; // 6s video
    const rate = 2.0; // 2s analysis per 1s video → 12s total
    const now = 6000; // 6s elapsed

    const result = estimateAnalysisProgress(startMs, videoDurationMs, rate, now);
    expect(result.progress).toBeCloseTo(0.5, 2);
    expect(result.estimatedRemainingMs).toBe(6000);
  });

  it('should return 0 progress and remaining for zero video duration', () => {
    const result = estimateAnalysisProgress(0, 0, 1.0, 5000);
    expect(result.progress).toBe(0);
    expect(result.estimatedRemainingMs).toBe(0);
  });
});

describe('computeSecondsPerVideoSecond', () => {
  it('should compute rate from analysis and video durations', () => {
    expect(computeSecondsPerVideoSecond(10000, 5000)).toBe(2.0);
  });

  it('should return 1.0 for equal durations', () => {
    expect(computeSecondsPerVideoSecond(5000, 5000)).toBe(1.0);
  });

  it('should return default for zero video duration', () => {
    expect(computeSecondsPerVideoSecond(10000, 0)).toBe(1.0);
  });

  it('should handle fast analysis', () => {
    expect(computeSecondsPerVideoSecond(3000, 6000)).toBe(0.5);
  });
});

describe('formatRemainingTime', () => {
  it('should format seconds only', () => {
    expect(formatRemainingTime(5000)).toBe('5s');
  });

  it('should format minutes and seconds', () => {
    expect(formatRemainingTime(95000)).toBe('1m 35s');
  });

  it('should format zero', () => {
    expect(formatRemainingTime(0)).toBe('0s');
  });

  it('should round up partial seconds', () => {
    expect(formatRemainingTime(1500)).toBe('2s');
  });
});
