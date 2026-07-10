import {
  aggregateSetVelocity,
  computeIntervalVelocityMetrics,
  computeRepResultsFromTracking,
  computeVelocityDelta,
  calculateVerticalVelocitySeries,
  formatVelocityDelta,
  formatVelocityValue,
  getRepPhaseWindow,
  isConcentricFirstRep,
  resolveCompareRepResults,
  velocityUnitFor,
} from '../../app/utils/videoAnalysisSetAggregates';
import {BarPathPoint, BarTrackingResult, VideoAnalysisRepResult} from '../../app/models/entities/VideoAnalysis';

/**
 * Triangle-wave bar path: one eccentric-first rep per second at 100 px/s.
 * y goes 100 → 200 (down, eccentric) in [0, 1000] and 200 → 100 (up,
 * concentric) in [1000, 2000], sampled every 100 ms.
 */
const makeEccentricFirstRepSeries = (repCount = 1): BarPathPoint[] => {
  const points: BarPathPoint[] = [];
  for (let rep = 0; rep < repCount; rep++) {
    const base = rep * 2000;
    for (let t = 0; t <= 2000; t += 100) {
      if (rep > 0 && t === 0) {
        continue; // shared boundary sample
      }
      const y = t <= 1000 ? 100 + (t / 1000) * 100 : 200 - ((t - 1000) / 1000) * 100;
      points.push({tMs: base + t, x: 50, y});
    }
  }
  return points;
};

const makeTrackingResult = (repCount = 1): BarTrackingResult => ({
  analysisId: 1,
  units: 'px/s',
  barPathSeries: makeEccentricFirstRepSeries(repCount),
  confidenceSeries: [],
  repSegments: Array.from({length: repCount}, (_, i) => ({
    repIndex: i,
    startMs: i * 2000,
    turnaroundMs: i * 2000 + 1000,
    endMs: i * 2000 + 2000,
  })),
  repMetrics: [],
  analysisMeta: {
    sourceFps: 30,
    analyzedFps: 30,
    frameCount: 60,
    averageConfidence: 1,
    trackingFrameWidthPx: 720,
    trackingFrameHeightPx: 1280,
  },
  qualityFlags: [],
});

const makeRepResult = (overrides: Partial<VideoAnalysisRepResult>): VideoAnalysisRepResult => ({
  repIndex: 0,
  startMs: 0,
  turnaroundMs: 1000,
  endMs: 2000,
  totalTimeMs: 2000,
  eccentricTimeMs: 1000,
  concentricTimeMs: 1000,
  vAvg: 0,
  vPeak: 0,
  ...overrides,
});

describe('isConcentricFirstRep / getRepPhaseWindow', () => {
  it('classifies a top-start rep (squat/bench) as eccentric-first', () => {
    const series = makeEccentricFirstRepSeries();
    expect(isConcentricFirstRep(series, 0, 1000)).toBe(false);
    const window = getRepPhaseWindow(series, 0, 1000, 2000);
    expect(window.concentricFirst).toBe(false);
    expect(window.eccentricStartMs).toBe(0);
    expect(window.concentricStartMs).toBe(1000);
    expect(window.concentricEndMs).toBe(2000);
  });

  it('classifies a bottom-start rep (deadlift) as concentric-first', () => {
    // Inverted triangle: starts at the floor (y=200), turns at the top (y=100).
    const series = makeEccentricFirstRepSeries().map((p) => ({...p, y: 300 - p.y}));
    expect(isConcentricFirstRep(series, 0, 1000)).toBe(true);
    const window = getRepPhaseWindow(series, 0, 1000, 2000);
    expect(window.concentricStartMs).toBe(0);
    expect(window.concentricEndMs).toBe(1000);
  });
});

describe('calculateVerticalVelocitySeries', () => {
  it('yields ~100 px/s magnitude for a 100 px/s triangle wave', () => {
    const velocity = calculateVerticalVelocitySeries(makeEccentricFirstRepSeries());
    // Mid-descent sample: steady -100 px/s (down = negative)
    expect(velocity[5]).toBeCloseTo(-100, 0);
    // Mid-ascent sample: steady +100 px/s
    expect(velocity[15]).toBeCloseTo(100, 0);
  });
});

describe('computeIntervalVelocityMetrics', () => {
  it('averages |velocity| over the interval and takes the peak', () => {
    const series: BarPathPoint[] = [
      {tMs: 0, x: 0, y: 0},
      {tMs: 100, x: 0, y: 0},
      {tMs: 200, x: 0, y: 0},
    ];
    const metrics = computeIntervalVelocityMetrics(series, [-50, -100, -150], 0, 200);
    expect(metrics).toEqual({vAvg: 100, vPeak: 150});
  });

  it('returns null for an empty or inverted interval', () => {
    const series: BarPathPoint[] = [{tMs: 0, x: 0, y: 0}];
    expect(computeIntervalVelocityMetrics(series, [10], 500, 400)).toBeNull();
    expect(computeIntervalVelocityMetrics(series, [10], 100, 200)).toBeNull();
  });
});

describe('computeRepResultsFromTracking', () => {
  it('computes non-zero concentric vAvg/vPeak for every rep (no 0-fallback)', () => {
    const repResults = computeRepResultsFromTracking(makeTrackingResult(3));
    expect(repResults).toHaveLength(3);
    for (const rep of repResults) {
      // Steady 100 px/s ascent; the zero-crossing at the turnaround plus the
      // ±2-sample smoothing window pull the coarse 100 ms-sampled average
      // well below the plateau, but the peak must sit on it.
      expect(rep.vAvg).toBeGreaterThanOrEqual(50);
      expect(rep.vAvg).toBeLessThanOrEqual(100);
      expect(rep.vPeak).toBeGreaterThanOrEqual(90);
      expect(rep.vPeak).toBeLessThanOrEqual(100);
      expect(rep.concentricTimeMs).toBe(1000);
      expect(rep.eccentricTimeMs).toBe(1000);
      expect(rep.totalTimeMs).toBe(2000);
    }
    expect(repResults.map((rep) => rep.repIndex)).toEqual([0, 1, 2]);
  });
});

describe('resolveCompareRepResults', () => {
  it('prefers the saved calibrated setResult', () => {
    const saved = {repResults: [makeRepResult({vAvg: 123, vPeak: 456})], velocityLossPercent: null, rirEstimate: null};
    const resolved = resolveCompareRepResults(makeTrackingResult(), saved);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].vAvg).toBe(123);
  });

  it('falls back to computed tracking values when no setResult exists', () => {
    const resolved = resolveCompareRepResults(makeTrackingResult(), undefined);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].vAvg).toBeGreaterThan(0);
    expect(resolved[0].vPeak).toBeGreaterThan(0);
  });

  it('ignores an empty saved repResults list', () => {
    const saved = {repResults: [], velocityLossPercent: null, rirEstimate: null};
    expect(resolveCompareRepResults(makeTrackingResult(), saved)[0].vAvg).toBeGreaterThan(0);
  });

  it('returns [] without tracking data', () => {
    expect(resolveCompareRepResults(undefined, undefined)).toEqual([]);
  });
});

describe('aggregateSetVelocity', () => {
  it('aggregates over ALL reps: mean of vAvg, max of vPeak', () => {
    const aggregate = aggregateSetVelocity([
      makeRepResult({vAvg: 100, vPeak: 200}),
      makeRepResult({vAvg: 80, vPeak: 260}),
      makeRepResult({vAvg: 90, vPeak: 180}),
    ]);
    expect(aggregate.repCount).toBe(3);
    expect(aggregate.meanVAvgPxPerS).toBe(90);
    expect(aggregate.peakVPeakPxPerS).toBe(260);
  });

  it('skips reps without velocity data instead of dragging the mean to 0', () => {
    const aggregate = aggregateSetVelocity([
      makeRepResult({vAvg: 100, vPeak: 200}),
      makeRepResult({vAvg: 0, vPeak: 0}),
    ]);
    expect(aggregate.repCount).toBe(2);
    expect(aggregate.meanVAvgPxPerS).toBe(100);
    expect(aggregate.peakVPeakPxPerS).toBe(200);
  });

  it('returns nulls when no rep has data', () => {
    const aggregate = aggregateSetVelocity([makeRepResult({vAvg: 0, vPeak: 0})]);
    expect(aggregate.meanVAvgPxPerS).toBeNull();
    expect(aggregate.peakVPeakPxPerS).toBeNull();
  });
});

describe('velocity display + delta', () => {
  it('formats px/s as whole numbers and m/s with 3 decimals', () => {
    expect(formatVelocityValue(266.6)).toBe('267');
    expect(formatVelocityValue(266.6, 0.0017)).toBe('0.453');
    expect(formatVelocityValue(null)).toBe('—');
    expect(velocityUnitFor(0.0017)).toBe('m/s');
    expect(velocityUnitFor(undefined)).toBe('px/s');
  });

  it('computes B − A delta in px/s when neither side is calibrated', () => {
    expect(computeVelocityDelta(267, 242)).toEqual({delta: -25, unit: 'px/s'});
  });

  it('computes B − A delta in m/s when both sides are calibrated', () => {
    const delta = computeVelocityDelta(100, 100, 0.002, 0.003);
    expect(delta?.unit).toBe('m/s');
    expect(delta?.delta).toBeCloseTo(0.1, 5);
  });

  it('returns null for mixed calibration or missing values', () => {
    expect(computeVelocityDelta(100, 100, 0.002, undefined)).toBeNull();
    expect(computeVelocityDelta(null, 100)).toBeNull();
    expect(computeVelocityDelta(100, undefined)).toBeNull();
  });

  it('formats deltas sign-correctly', () => {
    expect(formatVelocityDelta(-25, 'px/s')).toBe('−25');
    expect(formatVelocityDelta(9, 'px/s')).toBe('+9');
    expect(formatVelocityDelta(0.017, 'm/s')).toBe('+0.017');
    expect(formatVelocityDelta(-0.017, 'm/s')).toBe('−0.017');
  });
});
