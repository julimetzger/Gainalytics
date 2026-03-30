import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {importVideoAnalysisFromSource} from '../video-analysis-import';

jest.mock('../videoAnalysisStorage', () => ({
  copyImportedVideoToLocalStorage: jest.fn(),
}));

jest.mock('../videoAnalysisNative', () => ({
  prepareSquatVideoSeed: jest.fn(),
  analyzeSquatVideo: jest.fn(),
  getVideoDuration: jest.fn(),
}));

jest.mock('../videoAnalysisNotification', () => ({
  requestVideoAnalysisNotificationPermission: jest.fn().mockResolvedValue(true),
  postVideoAnalysisCompleteNotification: jest.fn().mockResolvedValue(undefined),
  postVideoAnalysisFailedNotification: jest.fn().mockResolvedValue(undefined),
}));

const {copyImportedVideoToLocalStorage} = jest.requireMock('../videoAnalysisStorage') as {
  copyImportedVideoToLocalStorage: jest.Mock;
};

const {prepareSquatVideoSeed, analyzeSquatVideo, getVideoDuration} = jest.requireMock('../videoAnalysisNative') as {
  prepareSquatVideoSeed: jest.Mock;
  analyzeSquatVideo: jest.Mock;
  getVideoDuration: jest.Mock;
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

describe('importVideoAnalysisFromSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getVideoDuration.mockResolvedValue(0);
  });

  it('should auto-analyze when exactly one candidate is found', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    const outcome = await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(outcome).toBe('done');
    expect(mocks.setVideoAnalysisStatus.mock.calls).toEqual([[7, VideoAnalysisStatus.PROCESSING]]);
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
      [8, VideoAnalysisStatus.PROCESSING],
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
      [9, VideoAnalysisStatus.PROCESSING],
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
    ).resolves.toBe('done');
    expect(mocks.attachVideoAnalysisResult).toHaveBeenCalled();
  });

  it('completes analysis even when notification permission is denied', async () => {
    requestVideoAnalysisNotificationPermission.mockResolvedValue(false);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    const outcome = await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(outcome).toBe('done');
    expect(mocks.attachVideoAnalysisResult).toHaveBeenCalled();
  });

  it('posts completion notification on success', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    // Allow the fire-and-forget notification promise to resolve
    await Promise.resolve();
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
    getVideoDuration.mockResolvedValue(8500);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(mocks.setVideoAnalysisDuration).toHaveBeenCalledWith(7, 8500);
  });

  it('does not call setVideoAnalysisDuration when native returns 0 (unknown)', async () => {
    getVideoDuration.mockResolvedValue(0);
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue(SINGLE_CANDIDATE_PREFLIGHT);
    analyzeSquatVideo.mockResolvedValue('/tmp/results/analysis-7.json');

    const mocks = makeMocks();
    await importVideoAnalysisFromSource({analysisId: 7, sourceUri: 'content://video.mp4', ...mocks});

    expect(mocks.setVideoAnalysisDuration).not.toHaveBeenCalled();
  });
});
