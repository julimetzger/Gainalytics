import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {importVideoAnalysisFromSource, calibrateFromSeed, PLATE_DIAMETER_M} from '../video-analysis-import';
import {
  getActiveAnalysisCount,
  getLastAnalysisSecondsPerVideoSecond,
  _resetActiveAnalysisCountForTesting,
  _resetLastAnalysisSecondsPerVideoSecondForTesting,
} from '../videoAnalysisProgress';

jest.mock('../videoAnalysisStorage', () => ({
  copyImportedVideoToLocalStorage: jest.fn(),
}));

jest.mock('../videoAnalysisNative', () => ({
  prepareSquatVideoSeed: jest.fn(),
  analyzeSquatVideo: jest.fn(),
  getVideoDuration: jest.fn(),
  startVideoAnalysisForegroundService: jest.fn(),
  stopVideoAnalysisForegroundService: jest.fn(),
}));

jest.mock('../videoAnalysisNotification', () => ({
  requestVideoAnalysisNotificationPermission: jest.fn().mockResolvedValue(true),
  postVideoAnalysisCompleteNotification: jest.fn().mockResolvedValue(undefined),
  postVideoAnalysisFailedNotification: jest.fn().mockResolvedValue(undefined),
}));

const {copyImportedVideoToLocalStorage} = jest.requireMock('../videoAnalysisStorage') as {
  copyImportedVideoToLocalStorage: jest.Mock;
};

const {prepareSquatVideoSeed, analyzeSquatVideo, getVideoDuration, startVideoAnalysisForegroundService, stopVideoAnalysisForegroundService} =
  jest.requireMock('../videoAnalysisNative') as {
  prepareSquatVideoSeed: jest.Mock;
  analyzeSquatVideo: jest.Mock;
  getVideoDuration: jest.Mock;
  startVideoAnalysisForegroundService: jest.Mock;
  stopVideoAnalysisForegroundService: jest.Mock;
};

const {
  requestVideoAnalysisNotificationPermission,
  postVideoAnalysisCompleteNotification,
  postVideoAnalysisFailedNotification,
} = jest.requireMock('../videoAnalysisNotification') as {
  requestVideoAnalysisNotificationPermission: jest.Mock;
  postVideoAnalysisCompleteNotification: jest.Mock;
  postVideoAnalysisFailedNotification: jest.Mock;
};

const makeMocks = () => ({
  addVideoAnalysis: jest.fn(),
  setVideoAnalysisStatus: jest.fn(),
  setVideoAnalysisDuration: jest.fn(),
  setManualSeedFramePath: jest.fn(),
  setSeedPreflight: jest.fn(),
  attachVideoAnalysisResult: jest.fn(),
  setMetersPerPixel: jest.fn(),
});

const SINGLE_CANDIDATE_PREFLIGHT = {
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
};

const flushBackgroundWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('importVideoAnalysisFromSource', () => {
  let consoleInfoSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    getVideoDuration.mockResolvedValue(0);
    _resetActiveAnalysisCountForTesting();
    _resetLastAnalysisSecondsPerVideoSecondForTesting();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('starts background analysis when exactly one candidate is found', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    const outcome = await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(outcome).toBe('analysis_started');
    expect(mocks.setVideoAnalysisStatus.mock.calls).toEqual([
      [7, VideoAnalysisStatus.COPYING],
      [7, VideoAnalysisStatus.PREFLIGHT],
      [7, VideoAnalysisStatus.PROCESSING],
    ]);
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
    await flushBackgroundWork();
    expect(mocks.attachVideoAnalysisResult.mock.calls).toEqual([[7, '/tmp/results/analysis-7.json', '/tmp/video.mp4']]);
    expect(mocks.setManualSeedFramePath.mock.calls).toEqual([]);
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

    const mocks = makeMocks();
    const outcome = await importVideoAnalysisFromSource({analysisId: 8, sourceUri: 'content://video.mp4', ...mocks});

    expect(outcome).toBe('awaiting_seed_selection');
    expect(mocks.setVideoAnalysisStatus.mock.calls).toEqual([
      [8, VideoAnalysisStatus.COPYING],
      [8, VideoAnalysisStatus.PREFLIGHT],
      [8, VideoAnalysisStatus.AWAITING_SEED_SELECTION],
    ]);
    expect(mocks.setSeedPreflight.mock.calls).toEqual([
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
    expect(mocks.attachVideoAnalysisResult.mock.calls).toEqual([]);
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

    const mocks = makeMocks();
    const outcome = await importVideoAnalysisFromSource({analysisId: 9, sourceUri: 'content://video.mp4', ...mocks});

    expect(outcome).toBe('failed_no_candidate');
    expect(mocks.setVideoAnalysisStatus.mock.calls).toEqual([
      [9, VideoAnalysisStatus.COPYING],
      [9, VideoAnalysisStatus.PREFLIGHT],
      [9, VideoAnalysisStatus.FAILED, 'No outer plate candidate found at t=0'],
    ]);
    expect(mocks.setManualSeedFramePath.mock.calls).toEqual([[9, '/tmp/preview.jpg', '/tmp/video.mp4']]);
    expect(mocks.attachVideoAnalysisResult.mock.calls).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Notification permission (ANA-005-fix: issue 2)
  // -------------------------------------------------------------------------

  it('requests notification permission before starting analysis', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(requestVideoAnalysisNotificationPermission).toHaveBeenCalledTimes(1);
  });

  it('does not throw when requestVideoAnalysisNotificationPermission rejects (permission guard)', async () => {
    requestVideoAnalysisNotificationPermission.mockRejectedValue(new Error('Bridge not initialised'));
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    // Should NOT throw — analysis must proceed even if permission throws
    await expect(
      importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks}),
    ).resolves.toBe('analysis_started');
    await flushBackgroundWork();
    expect(mocks.attachVideoAnalysisResult).toHaveBeenCalled();
  });

  it('completes analysis even when notification permission is denied', async () => {
    requestVideoAnalysisNotificationPermission.mockResolvedValue(false);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    const outcome = await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(outcome).toBe('analysis_started');
    await flushBackgroundWork();
    expect(mocks.attachVideoAnalysisResult).toHaveBeenCalled();
  });

  it('posts completion notification on success', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    await flushBackgroundWork();
    expect(postVideoAnalysisCompleteNotification).toHaveBeenCalledWith(7);
  });

  it('posts failure notification when no candidate is found', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue({
      previewFramePath: '/tmp/preview.jpg',
      frameWidthPx: 1080,
      frameHeightPx: 1920,
      trackerVersion: 'tflite-yolo26-outer-plate-v1',
      candidates: [],
    });

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 9, sourceUri: 'content://video.mp4', ...mocks});

    await Promise.resolve();
    expect(postVideoAnalysisFailedNotification).toHaveBeenCalledWith(9);
  });

  // -------------------------------------------------------------------------
  // Duration-based progress (ANA-005-fix: issue 3)
  // -------------------------------------------------------------------------

  it('calls setVideoAnalysisDuration with the actual duration from native', async () => {
    getVideoDuration.mockResolvedValueOnce(0).mockResolvedValueOnce(8500);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    await flushBackgroundWork();
    expect(mocks.setVideoAnalysisDuration).toHaveBeenCalledWith(7, 8500);
  });

  it('does not call setVideoAnalysisDuration when native returns 0 (unknown)', async () => {
    getVideoDuration.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    await flushBackgroundWork();
    expect(mocks.setVideoAnalysisDuration).not.toHaveBeenCalled();
  });

  it('adds card immediately with zero duration then updates from source metadata', async () => {
    getVideoDuration.mockResolvedValueOnce(45_000).mockResolvedValueOnce(45_000);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    await flushBackgroundWork();
    // Card is added immediately with durationMs: 0 — no async blocking before addVideoAnalysis.
    expect(mocks.addVideoAnalysis).toHaveBeenCalledWith({
      id: 7,
      sourceUri: 'content://video.mp4',
      createdAt: expect.any(Date),
      status: VideoAnalysisStatus.QUEUED,
      videoMeta: {
        durationMs: 0,
        fps: 0,
        width: 0,
        height: 0,
      },
    });
    // Duration is then updated via setVideoAnalysisDuration from source metadata.
    // Local duration matches source (45_000 === 45_000), so only one update is made.
    expect(mocks.setVideoAnalysisDuration).toHaveBeenCalledWith(7, 45_000);
    expect(mocks.setVideoAnalysisDuration).toHaveBeenCalledTimes(1);
  });

  it('updates the learned analysis rate from the completed run duration and video duration', async () => {
    const timestamps = [1000, 1000, 5000, 10_000, 15_000, 20_000, 25_000, 46_000, 46_000, 46_000];
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => timestamps.shift() ?? 46_000);
    getVideoDuration.mockResolvedValueOnce(45_000).mockResolvedValueOnce(45_000);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    await flushBackgroundWork();
    expect(getLastAnalysisSecondsPerVideoSecond()).toBe(1);
    dateNowSpy.mockRestore();
  });

  it('calls onRateUpdated with the learned rate after analysis completes', async () => {
    // 90 s analysis on a 45 s video → rate = 2.0
    const timestamps = [0, 0, 0, 0, 0, 0, 0, 90_000, 90_000, 90_000];
    const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => timestamps.shift() ?? 90_000);
    getVideoDuration.mockResolvedValueOnce(45_000).mockResolvedValueOnce(45_000);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-8.json');

    const onRateUpdated = jest.fn();
    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 8, sourceUri: 'content://video.mp4', ...mocks, onRateUpdated});

    await flushBackgroundWork();
    expect(onRateUpdated).toHaveBeenCalledWith(2);
    dateNowSpy.mockRestore();
  });

  it('does NOT call onRateUpdated when videoDurationMs is 0 (would clobber persisted rate)', async () => {
    // Both source and local duration reads return 0 → videoDurationMs stays 0.
    getVideoDuration.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-9.json');

    const onRateUpdated = jest.fn();
    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 9, sourceUri: 'content://video.mp4', ...mocks, onRateUpdated});

    await flushBackgroundWork();
    expect(onRateUpdated).not.toHaveBeenCalled();
    // The previously persisted rate (the in-memory default here) must remain untouched.
    expect(getLastAnalysisSecondsPerVideoSecond()).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Foreground-service reference counting (ANA-005-fix issue 3 – integration)
  // -------------------------------------------------------------------------

  it('increments active count during background analysis and decrements it on completion', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    let resolveAnalysis!: (value: string) => void;
    const analysisDone = new Promise<string>((resolve) => {
      resolveAnalysis = resolve;
    });
    analyzeSquatVideo.mockReturnValue(analysisDone);

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(startVideoAnalysisForegroundService).toHaveBeenCalledTimes(1);
    expect(getActiveAnalysisCount()).toBe(1);
    resolveAnalysis('/tmp/results/analysis-7.json');
    await flushBackgroundWork();
    expect(getActiveAnalysisCount()).toBe(0);
    expect(stopVideoAnalysisForegroundService).toHaveBeenCalledTimes(1);
  });

  it('decrements active count even when the background analysis throws', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    let rejectAnalysis!: (error: Error) => void;
    const analysisFailed = new Promise<string>((_, reject) => {
      rejectAnalysis = reject;
    });
    analyzeSquatVideo.mockReturnValue(analysisFailed);

    const mocks = makeMocks();
    await expect(importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks})).resolves.toBe(
      'analysis_started',
    );

    expect(getActiveAnalysisCount()).toBe(1);
    rejectAnalysis(new Error('Native module crashed'));
    await flushBackgroundWork();
    expect(getActiveAnalysisCount()).toBe(0);
    expect(mocks.setVideoAnalysisStatus).toHaveBeenLastCalledWith(7, VideoAnalysisStatus.FAILED, 'Background analysis failed');
    expect(stopVideoAnalysisForegroundService).toHaveBeenCalledTimes(1);
  });

  it('keeps active count at 1 while a concurrent analysis is still running', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);

    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const firstDone = new Promise<string>((res) => (resolveFirst = res));
    const secondDone = new Promise<string>((res) => (resolveSecond = res));
    analyzeSquatVideo.mockReturnValueOnce(firstDone).mockReturnValueOnce(secondDone);

    const mocks = makeMocks();

    await expect(importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks})).resolves.toBe(
      'analysis_started',
    );
    await expect(importVideoAnalysisFromSource({analysisId: 8, sourceUri: 'content://video.mp4', ...mocks})).resolves.toBe(
      'analysis_started',
    );

    expect(startVideoAnalysisForegroundService).toHaveBeenCalledTimes(1);
    expect(getActiveAnalysisCount()).toBe(2);

    resolveFirst('/tmp/results/analysis-7.json');
    await flushBackgroundWork();

    expect(stopVideoAnalysisForegroundService).not.toHaveBeenCalled();
    expect(getActiveAnalysisCount()).toBe(1);

    resolveSecond('/tmp/results/analysis-8.json');
    await flushBackgroundWork();

    expect(getActiveAnalysisCount()).toBe(0);
    expect(stopVideoAnalysisForegroundService).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Calibration: automatic single-candidate path must call setMetersPerPixel
  // -------------------------------------------------------------------------

  it('calls setMetersPerPixel with the correct value when a single candidate is found', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    // Expected: PLATE_DIAMETER_M / (normalizedWidth * frameWidthPx)
    // = 0.45 / (0.12 * 1080) = 0.45 / 129.6 ~ 0.003472
    const expectedMpp = PLATE_DIAMETER_M / (0.12 * 1080);
    expect(mocks.setMetersPerPixel).toHaveBeenCalledTimes(1);
    expect(mocks.setMetersPerPixel).toHaveBeenCalledWith(7, expectedMpp);
  });

  it('does not call setMetersPerPixel when multiple candidates require manual selection', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue({
      previewFramePath: '/tmp/preview.jpg',
      frameWidthPx: 1080,
      frameHeightPx: 1920,
      trackerVersion: 'tflite-yolo26-outer-plate-v1',
      candidates: [
        {id: 'c1', normalizedX: 0.3, normalizedY: 0.4, normalizedWidth: 0.12, normalizedHeight: 0.08, score: 0.91},
        {id: 'c2', normalizedX: 0.6, normalizedY: 0.4, normalizedWidth: 0.11, normalizedHeight: 0.08, score: 0.72},
      ],
    });

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 8, sourceUri: 'content://video.mp4', ...mocks});

    expect(mocks.setMetersPerPixel).not.toHaveBeenCalled();
  });
});

describe('calibrateFromSeed', () => {
  it('computes metersPerPixel from normalizedWidth and frameWidthPx', () => {
    // plateWidthPx = 0.12 * 1080 = 129.6
    // mpp = 0.45 / 129.6 ~ 0.003472
    const result = calibrateFromSeed(0.12, 1080);
    expect(result).toBeCloseTo(PLATE_DIAMETER_M / (0.12 * 1080), 10);
  });

  it('returns null when frameWidthPx is 0', () => {
    expect(calibrateFromSeed(0.12, 0)).toBeNull();
  });

  it('returns null when normalizedWidth is 0', () => {
    expect(calibrateFromSeed(0, 1080)).toBeNull();
  });

  it('produces the same metersPerPixel for manual and automatic single-candidate flows', async () => {
    // Both the manual seed confirmation (VideoAnalysisDetailTab.runManualSeedAnalysis) and
    // the automatic single-candidate path (importVideoAnalysisFromSource) call calibrateFromSeed
    // with the same arguments. This test verifies they would reach the same calibration value
    // for an identical seed, ensuring no divergence between the two flows.
    const normalizedWidth = 0.12;
    const frameWidthPx = 1080;

    // Manual flow: directly calls calibrateFromSeed
    const mppManual = calibrateFromSeed(normalizedWidth, frameWidthPx);

    // Automatic flow: importVideoAnalysisFromSource calls calibrateFromSeed internally
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue({
      previewFramePath: '/tmp/preview.jpg',
      frameWidthPx,
      frameHeightPx: 1920,
      trackerVersion: 'tflite-yolo26-outer-plate-v1',
      candidates: [
        {id: 'c1', normalizedX: 0.3, normalizedY: 0.4, normalizedWidth, normalizedHeight: 0.08, score: 0.91},
      ],
    });
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-9.json');
    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 9, sourceUri: 'content://video.mp4', ...mocks});
    const mppAutomatic = mocks.setMetersPerPixel.mock.calls[0]?.[1] ?? null;

    expect(mppManual).not.toBeNull();
    expect(mppAutomatic).not.toBeNull();
    expect(mppAutomatic).toBe(mppManual);
  });
});
