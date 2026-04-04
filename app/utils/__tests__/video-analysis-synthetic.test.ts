import {buildSyntheticBarTrackingResult} from '../video-analysis-synthetic';

describe('buildSyntheticBarTrackingResult', () => {
  it('should build deterministic synthetic bar path and confidence series', () => {
    const result = buildSyntheticBarTrackingResult(7, {
      fps: 2,
      frameCount: 3,
      qualityFlags: ['TEST_SYNTHETIC'],
    });

    expect(result).toEqual({
      analysisId: 7,
      units: 'px/s',
      barPathSeries: [
        {tMs: 0, x: 620, y: 420},
        {tMs: 500, x: 625, y: 610},
        {tMs: 1000, x: 630, y: 420},
      ],
      confidenceSeries: [
        {tMs: 0, score: 0.96},
        {tMs: 500, score: 0.9},
        {tMs: 1000, score: 0.84},
      ],
      repSegments: [{repIndex: 1, startMs: 0, turnaroundMs: 500, endMs: 1000}],
      repMetrics: [
        {
          repIndex: 1,
          averageConcentricSpeedPxPerS: 380,
          lowestConcentricSpeedPxPerS: 380,
          repTimeMs: 1000,
        },
      ],
      analysisMeta: {
        sourceFps: 2,
        analyzedFps: 2,
        frameCount: 3,
        averageConfidence: 0.9,
      },
      qualityFlags: ['TEST_SYNTHETIC'],
    });
  });
});
