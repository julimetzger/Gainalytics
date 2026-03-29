import {BarPathPoint} from '../../models/entities/VideoAnalysis';
import {detectRepResultsFromBarPathSeries} from '../video-analysis-rep-detection';

const barPathSeries = [
  {tMs: 0, x: 100, y: 100},
  {tMs: 250, x: 100, y: 100},
  {tMs: 500, x: 100, y: 130},
  {tMs: 750, x: 100, y: 170},
  {tMs: 1000, x: 100, y: 200},
  {tMs: 1250, x: 100, y: 200},
  {tMs: 1500, x: 100, y: 170},
  {tMs: 1750, x: 100, y: 130},
  {tMs: 2000, x: 100, y: 100},
  {tMs: 2250, x: 100, y: 100},
  {tMs: 2500, x: 100, y: 130},
  {tMs: 2750, x: 100, y: 170},
  {tMs: 3000, x: 100, y: 200},
  {tMs: 3250, x: 100, y: 200},
  {tMs: 3500, x: 100, y: 170},
  {tMs: 3750, x: 100, y: 130},
  {tMs: 4000, x: 100, y: 100},
] satisfies BarPathPoint[];

describe('detectRepResultsFromBarPathSeries', () => {
  it('detects rep segments and concentric speed metrics from tracked motion', () => {
    expect(detectRepResultsFromBarPathSeries(barPathSeries)).toEqual({
      repSegments: [
        {repIndex: 1, startMs: 0, bottomMs: 1000, endMs: 2000},
        {repIndex: 2, startMs: 2000, bottomMs: 3000, endMs: 4000},
      ],
      repMetrics: [
        {
          repIndex: 1,
          averageConcentricSpeedPxPerS: 48,
          lowestConcentricSpeedPxPerS: 13.6,
          repTimeMs: 2000,
        },
        {
          repIndex: 2,
          averageConcentricSpeedPxPerS: 40.667,
          lowestConcentricSpeedPxPerS: 6.667,
          repTimeMs: 2000,
        },
      ],
    });
  });
});
