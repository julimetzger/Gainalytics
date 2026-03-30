import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {importVideoAnalysisFromSource} from '../video-analysis-import';

jest.mock('../videoAnalysisStorage', () => ({
  copyImportedVideoToLocalStorage: jest.fn(),
}));

jest.mock('../videoAnalysisNative', () => ({
  prepareSquatVideoSeed: jest.fn(),
  analyzeSquatVideo: jest.fn(),
  startVideoAnalysisForegroundService: jest.fn(),
  stopVideoAnalysisForegroundService: jest.fn(),
}));

jest.mock('../videoAnalysisNotification', () => ({
  showAnalysisCompleteNotification: jest.fn().mockResolvedValue(undefined),
  showAnalysisFailedNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../videoAnalysisProgress', () => ({
  computeSecondsPerVideoSecond: jest.fn().mockReturnValue(1.0),
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

  it('should start background analysis and return analysis_started when exactly one candidate is found', async () => {
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
    const setLastAnalysisSecondsPerVideoSecond = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 7,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
      setLastAnalysisSecondsPerVideoSecond,
    });

    expect(outcome).toBe('analysis_started');
    // First call: PROCESSING, second call: PROCESSING with analysisStartedAtMs and videoDurationMs
    expect(setVideoAnalysisStatus).toHaveBeenCalledTimes(2);
    expect(setVideoAnalysisStatus.mock.calls[0]).toEqual([7, VideoAnalysisStatus.PROCESSING]);
    expect(setVideoAnalysisStatus.mock.calls[1][0]).toBe(7);
    expect(setVideoAnalysisStatus.mock.calls[1][1]).toBe(VideoAnalysisStatus.PROCESSING);
    expect(setVideoAnalysisStatus.mock.calls[1][3]).toHaveProperty('analysisStartedAtMs');
    expect(setVideoAnalysisStatus.mock.calls[1][3]).toHaveProperty('videoDurationMs');

    // analyzeSquatVideo was called (fire-and-forget)
    expect(analyzeSquatVideo).toHaveBeenCalledWith(
      '/tmp/video.mp4',
      7,
      {
        candidateId: 'candidate-1',
        normalizedX: 0.3,
        normalizedY: 0.4,
        normalizedWidth: 0.12,
        normalizedHeight: 0.08,
      },
    );
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
    const setLastAnalysisSecondsPerVideoSecond = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 8,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
      setLastAnalysisSecondsPerVideoSecond,
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
    const setLastAnalysisSecondsPerVideoSecond = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 9,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
      setLastAnalysisSecondsPerVideoSecond,
    });

    expect(outcome).toBe('failed_no_candidate');
    expect(setVideoAnalysisStatus.mock.calls).toEqual([
      [9, VideoAnalysisStatus.PROCESSING],
      [9, VideoAnalysisStatus.FAILED, 'No outer plate candidate found at t=0'],
    ]);
    expect(setManualSeedFramePath.mock.calls).toEqual([[9, '/tmp/preview.jpg', '/tmp/video.mp4']]);
    expect(attachVideoAnalysisResult.mock.calls).toEqual([]);
  });

  it('should handle background analysis completion with result attachment', async () => {
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
    // Simulate the background analysis resolving
    let resolveAnalysis: (value: string) => void;
    analyzeSquatVideo.mockReturnValue(new Promise<string>((resolve) => {
      resolveAnalysis = resolve;
    }));

    const addVideoAnalysis = jest.fn();
    const setVideoAnalysisStatus = jest.fn();
    const setManualSeedFramePath = jest.fn();
    const setSeedPreflight = jest.fn();
    const attachVideoAnalysisResult = jest.fn();
    const setLastAnalysisSecondsPerVideoSecond = jest.fn();

    await importVideoAnalysisFromSource({
      analysisId: 10,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
      setLastAnalysisSecondsPerVideoSecond,
    });

    // Resolve the background analysis
    resolveAnalysis!('/tmp/results/analysis-10.json');
    // Wait for microtasks to flush
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(attachVideoAnalysisResult).toHaveBeenCalledWith(10, '/tmp/results/analysis-10.json', '/tmp/video.mp4');
    expect(setLastAnalysisSecondsPerVideoSecond).toHaveBeenCalled();
  });

  it('should handle background analysis failure gracefully', async () => {
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
    let rejectAnalysis: (reason: Error) => void;
    analyzeSquatVideo.mockReturnValue(new Promise<string>((_, reject) => {
      rejectAnalysis = reject;
    }));

    const addVideoAnalysis = jest.fn();
    const setVideoAnalysisStatus = jest.fn();
    const setManualSeedFramePath = jest.fn();
    const setSeedPreflight = jest.fn();
    const attachVideoAnalysisResult = jest.fn();
    const setLastAnalysisSecondsPerVideoSecond = jest.fn();

    await importVideoAnalysisFromSource({
      analysisId: 11,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
      attachVideoAnalysisResult,
      setLastAnalysisSecondsPerVideoSecond,
    });

    // Reject the background analysis
    rejectAnalysis!(new Error('TFLite model failed'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should set FAILED status
    const failedCall = setVideoAnalysisStatus.mock.calls.find(
      (call: unknown[]) => call[1] === VideoAnalysisStatus.FAILED,
    );
    expect(failedCall).toBeTruthy();
    expect(failedCall![2]).toBe('Background analysis failed');
    expect(attachVideoAnalysisResult).not.toHaveBeenCalled();
  });
});
