import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {importVideoAnalysisFromSource} from '../video-analysis-import';

jest.mock('../videoAnalysisStorage', () => ({
  copyImportedVideoToLocalStorage: jest.fn(),
}));

jest.mock('../videoAnalysisNative', () => ({
  prepareSquatVideoSeed: jest.fn(),
  analyzeSquatVideo: jest.fn(),
}));

const {copyImportedVideoToLocalStorage} = jest.requireMock('../videoAnalysisStorage') as {
  copyImportedVideoToLocalStorage: jest.Mock;
};

const {prepareSquatVideoSeed, analyzeSquatVideo} = jest.requireMock('../videoAnalysisNative') as {
  prepareSquatVideoSeed: jest.Mock;
  analyzeSquatVideo: jest.Mock;
};

describe('importVideoAnalysisFromSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should auto-analyze when exactly one candidate is found', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue({
      previewFramePath: '/tmp/preview.jpg',
      frameWidthPx: 1080,
      frameHeightPx: 1920,
      trackerVersion: 'tflite-yolo26-outer-plate-v1',
      candidates: [
        {
          id: 'candidate-1',
          normalizedX: 0.3,
          normalizedY: 0.4,
          normalizedWidth: 0.12,
          normalizedHeight: 0.08,
          score: 0.91,
        },
      ],
    });
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const addVideoAnalysis = jest.fn();
    const setVideoAnalysisStatus = jest.fn();
    const setManualSeedFramePath = jest.fn();
    const setSeedPreflight = jest.fn();
    const attachVideoAnalysisResult = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 7,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
    });

    expect(outcome).toBe('done');
    expect(setVideoAnalysisStatus.mock.calls).toEqual([[7, VideoAnalysisStatus.PROCESSING]]);
    expect(analyzeSquatVideo.mock.calls).toEqual([
      [
        '/tmp/video.mp4',
        7,
        {
          candidateId: 'candidate-1',
          normalizedX: 0.3,
          normalizedY: 0.4,
          normalizedWidth: 0.12,
          normalizedHeight: 0.08,
        },
      ],
    ]);
    expect(attachVideoAnalysisResult.mock.calls).toEqual([[7, '/tmp/results/analysis-7.json', '/tmp/video.mp4']]);
    expect(setManualSeedFramePath.mock.calls).toEqual([]);
  });

  it('should move the analysis to awaiting seed selection when multiple candidates are found', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue({
      previewFramePath: '/tmp/preview.jpg',
      frameWidthPx: 1080,
      frameHeightPx: 1920,
      trackerVersion: 'tflite-yolo26-outer-plate-v1',
      candidates: [
        {
          id: 'candidate-1',
          normalizedX: 0.3,
          normalizedY: 0.4,
          normalizedWidth: 0.12,
          normalizedHeight: 0.08,
          score: 0.91,
        },
        {
          id: 'candidate-2',
          normalizedX: 0.66,
          normalizedY: 0.39,
          normalizedWidth: 0.11,
          normalizedHeight: 0.08,
          score: 0.72,
        },
      ],
    });

    const addVideoAnalysis = jest.fn();
    const setVideoAnalysisStatus = jest.fn();
    const setManualSeedFramePath = jest.fn();
    const setSeedPreflight = jest.fn();
    const attachVideoAnalysisResult = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 8,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
    });

    expect(outcome).toBe('awaiting_seed_selection');
    expect(setVideoAnalysisStatus.mock.calls).toEqual([
      [8, VideoAnalysisStatus.PROCESSING],
      [8, VideoAnalysisStatus.AWAITING_SEED_SELECTION],
    ]);
    expect(setSeedPreflight.mock.calls).toEqual([
      [
        8,
        '/tmp/preview.jpg',
        [
          {
            id: 'candidate-1',
            normalizedX: 0.3,
            normalizedY: 0.4,
            normalizedWidth: 0.12,
            normalizedHeight: 0.08,
            score: 0.91,
          },
          {
            id: 'candidate-2',
            normalizedX: 0.66,
            normalizedY: 0.39,
            normalizedWidth: 0.11,
            normalizedHeight: 0.08,
            score: 0.72,
          },
        ],
        1080,
        1920,
        '/tmp/video.mp4',
      ],
    ]);
    expect(attachVideoAnalysisResult.mock.calls).toEqual([]);
  });

  it('should fail with a dedicated outcome when no candidate is found at t=0', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue({
      previewFramePath: '/tmp/preview.jpg',
      frameWidthPx: 1080,
      frameHeightPx: 1920,
      trackerVersion: 'tflite-yolo26-outer-plate-v1',
      candidates: [],
    });

    const addVideoAnalysis = jest.fn();
    const setVideoAnalysisStatus = jest.fn();
    const setManualSeedFramePath = jest.fn();
    const setSeedPreflight = jest.fn();
    const attachVideoAnalysisResult = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 9,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
    });

    expect(outcome).toBe('failed_no_candidate');
    expect(setVideoAnalysisStatus.mock.calls).toEqual([
      [9, VideoAnalysisStatus.PROCESSING],
      [9, VideoAnalysisStatus.FAILED, 'No outer plate candidate found at t=0'],
    ]);
    expect(setManualSeedFramePath.mock.calls).toEqual([[9, '/tmp/preview.jpg', '/tmp/video.mp4']]);
    expect(attachVideoAnalysisResult.mock.calls).toEqual([]);
  });
});
