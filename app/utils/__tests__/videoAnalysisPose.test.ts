/**
 * GH-75: hip/knee pose points in the video analysis result.
 */
import RNFS from 'react-native-fs';
import {BarTrackingResult, PoseSample} from '../../models/entities/VideoAnalysis';
import {readBarTrackingResultFromFile} from '../videoAnalysisStorage';
import {
  buildPoseOverlayTracks,
  getPoseMaxGapMs,
  interpolatePoseJointAt,
  normalizeBarTrackingResult,
  parsePoseSeries,
  selectPoseSides,
} from '../videoAnalysisPose';

const LEGACY_RESULT: BarTrackingResult = {
  analysisId: 3,
  units: 'px/s',
  barPathSeries: [
    {tMs: 0, x: 100, y: 200},
    {tMs: 33, x: 101, y: 210},
  ],
  confidenceSeries: [
    {tMs: 0, score: 0.9},
    {tMs: 33, score: 0.91},
  ],
  repSegments: [{repIndex: 0, startMs: 0, turnaroundMs: 16, endMs: 33}],
  repMetrics: [],
  analysisMeta: {sourceFps: 30, analyzedFps: 30, frameCount: 2, averageConfidence: 0.9, repDetectionVersion: 'v5'},
  qualityFlags: ['ANALYSIS_NATIVE_TFLITE_YOLO26'],
};

const point = (x: number, y: number, visibility: number) => ({x, y, visibility});

const sample = (tMs: number, leftVisibility: number, rightVisibility: number, x = 0.5): PoseSample => ({
  tMs,
  left: {hip: point(x, 0.5, leftVisibility), knee: point(x + 0.1, 0.7, leftVisibility)},
  right: {hip: point(x + 0.02, 0.5, rightVisibility), knee: point(x + 0.12, 0.7, rightVisibility)},
});

describe('parsePoseSeries / normalizeBarTrackingResult', () => {
  it('loads a result without pose points unchanged (pre-GH-75 analyses)', () => {
    const normalized = normalizeBarTrackingResult(LEGACY_RESULT);

    expect(normalized).toBe(LEGACY_RESULT);
    expect(normalized.poseSeries).toBeUndefined();
  });

  it('keeps a valid series with time, normalised x/y, visibility and side', () => {
    const raw = {
      ...LEGACY_RESULT,
      poseSeries: [
        {tMs: 33, left: {hip: point(0.41, 0.52, 0.98), knee: point(0.45, 0.7, 0.97)}},
        {tMs: 0, right: {hip: point(0.6, 0.5, 0.3)}},
      ],
    };

    const normalized = normalizeBarTrackingResult(raw);

    expect(normalized.poseSeries).toEqual([
      {tMs: 0, right: {hip: {x: 0.6, y: 0.5, visibility: 0.3}}},
      {tMs: 33, left: {hip: {x: 0.41, y: 0.52, visibility: 0.98}, knee: {x: 0.45, y: 0.7, visibility: 0.97}}},
    ]);
    expect(normalized.barPathSeries).toBe(LEGACY_RESULT.barPathSeries);
  });

  it('drops malformed samples and points, and keeps frames without a person as gaps', () => {
    const parsed = parsePoseSeries([
      {tMs: 0, left: {hip: point(0.4, 0.5, 0.9), knee: {x: 'a', y: 0.7, visibility: 0.9}}},
      {tMs: 33},
      {tMs: 'later', left: {hip: point(0.4, 0.5, 0.9)}},
      null,
      {tMs: 66, left: {hip: point(0.4, 0.5, 1.7)}},
    ]);

    expect(parsed).toEqual([
      {tMs: 0, left: {hip: {x: 0.4, y: 0.5, visibility: 0.9}}},
      {tMs: 33},
      {tMs: 66, left: {hip: {x: 0.4, y: 0.5, visibility: 1}}},
    ]);
  });

  it('keeps a series in which no person was found (analysed, but nothing detected)', () => {
    expect(parsePoseSeries([{tMs: 33}, {tMs: 0}])).toEqual([{tMs: 0}, {tMs: 33}]);
    expect(selectPoseSides(parsePoseSeries([{tMs: 0}, {tMs: 33}]))).toEqual([]);
  });

  it('removes a series that is not an array', () => {
    expect(parsePoseSeries({tMs: 0})).toBeUndefined();

    const normalized = normalizeBarTrackingResult({...LEGACY_RESULT, poseSeries: 'broken' as unknown as PoseSample[]});
    expect('poseSeries' in normalized).toBe(false);
  });

  it('readBarTrackingResultFromFile migrates on load: legacy without, new with points', async () => {
    const withPose = {...LEGACY_RESULT, poseSeries: [sample(0, 0.9, 0.4)]};
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(LEGACY_RESULT)).mockResolvedValueOnce(JSON.stringify(withPose));

    const legacy = await readBarTrackingResultFromFile('/x/analysis-3.json');
    const current = await readBarTrackingResultFromFile('/x/analysis-3.json');

    expect(legacy).toEqual(LEGACY_RESULT);
    expect(legacy?.poseSeries).toBeUndefined();
    expect(current?.poseSeries).toEqual([sample(0, 0.9, 0.4)]);
  });
});

describe('selectPoseSides', () => {
  it('shows only the side facing the camera (higher average visibility)', () => {
    expect(selectPoseSides([sample(0, 0.95, 0.6), sample(33, 0.9, 0.55)])).toEqual(['left']);
    expect(selectPoseSides([sample(0, 0.4, 0.92), sample(33, 0.5, 0.9)])).toEqual(['right']);
  });

  it('shows both sides when both are clearly visible', () => {
    expect(selectPoseSides([sample(0, 0.95, 0.9), sample(33, 0.93, 0.88)])).toEqual(['left', 'right']);
  });

  it('keeps one side when both are visible but one clearly more', () => {
    expect(selectPoseSides([sample(0, 0.99, 0.82), sample(33, 0.99, 0.82)])).toEqual(['left']);
  });

  it('counts frames without a person as invisible', () => {
    const series: PoseSample[] = [sample(0, 0.9, 0.9), {tMs: 33}, {tMs: 66}, {tMs: 99}];
    expect(selectPoseSides(series)).toEqual([]);
    expect(selectPoseSides(undefined)).toEqual([]);
  });
});

describe('interpolatePoseJointAt', () => {
  const series = [sample(0, 0.9, 0.2, 0.4), sample(100, 0.9, 0.2, 0.6), sample(200, 0.3, 0.2, 0.8), sample(300, 0.9, 0.2, 0.8)];

  it('interpolates linearly between two visible samples', () => {
    const at = interpolatePoseJointAt(series, 'left', 'hip', 25, 250);
    expect(at?.x).toBeCloseTo(0.45);
    expect(at?.y).toBeCloseTo(0.5);
    expect(interpolatePoseJointAt(series, 'left', 'knee', 50, 250)?.x).toBeCloseTo(0.6);
  });

  it('returns the sample itself on an exact sample time', () => {
    expect(interpolatePoseJointAt(series, 'left', 'hip', 100, 250)).toEqual({x: 0.6, y: 0.5});
  });

  it('hides the point next to a low-visibility sample instead of jumping', () => {
    expect(interpolatePoseJointAt(series, 'left', 'hip', 150, 250)).toBeUndefined();
    expect(interpolatePoseJointAt(series, 'left', 'hip', 250, 250)).toBeUndefined();
    expect(interpolatePoseJointAt(series, 'right', 'hip', 50, 250)).toBeUndefined();
  });

  it('hides the point across a gap larger than maxGapMs', () => {
    const gapped = [sample(0, 0.9, 0.9, 0.4), sample(500, 0.9, 0.9, 0.8)];
    expect(interpolatePoseJointAt(gapped, 'left', 'hip', 250, 250)).toBeUndefined();
    expect(interpolatePoseJointAt(gapped, 'left', 'hip', 250, 600)?.x).toBeCloseTo(0.6);
  });

  it('holds the edge samples for half a gap, then hides', () => {
    expect(interpolatePoseJointAt(series, 'left', 'hip', -50, 250)).toEqual({x: 0.4, y: 0.5});
    expect(interpolatePoseJointAt(series, 'left', 'hip', 400, 250)).toEqual({x: 0.8, y: 0.5});
    expect(interpolatePoseJointAt(series, 'left', 'hip', 450, 250)).toBeUndefined();
  });
});

describe('getPoseMaxGapMs / buildPoseOverlayTracks', () => {
  it('bridges 2.5 median sample intervals, at least 100 ms', () => {
    // One long gap does not move the median.
    expect(getPoseMaxGapMs([sample(0, 1, 1), sample(100, 1, 1), sample(200, 1, 1), sample(600, 1, 1)])).toBe(250);
    // 30 fps: 2.5 × 34 ms = 85 ms → raised to the 100 ms minimum.
    expect(getPoseMaxGapMs([sample(0, 1, 1), sample(33, 1, 1), sample(67, 1, 1), sample(100, 1, 1)])).toBe(100);
    // 15 fps.
    expect(getPoseMaxGapMs([sample(0, 1, 1), sample(67, 1, 1), sample(133, 1, 1)])).toBe(168);
    expect(getPoseMaxGapMs([sample(0, 1, 1)])).toBe(100);
  });

  it('flattens only the chosen side and leaves invisible points out', () => {
    const tracks = buildPoseOverlayTracks([sample(0, 0.9, 0.9, 0.4), sample(33, 0.2, 0.9, 0.5)], ['left']);

    expect(tracks).toEqual([
      {side: 'left', samples: [{tMs: 0, hipX: 0.4, hipY: 0.5, kneeX: 0.5, kneeY: 0.7}, {tMs: 33}]},
    ]);
  });
});
