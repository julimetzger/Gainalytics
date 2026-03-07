import {VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {importVideoAnalysisFromSource} from '../video-analysis-import';

jest.mock('../videoAnalysisStorage', () => ({
  copyImportedVideoToLocalStorage: jest.fn(),
}));

jest.mock('../videoAnalysisNative', () => ({
  prepareSquatVideoSeed: jest.fn(),
}));

const {copyImportedVideoToLocalStorage} = jest.requireMock('../videoAnalysisStorage') as {
  copyImportedVideoToLocalStorage: jest.Mock;
};

const {prepareSquatVideoSeed} = jest.requireMock('../videoAnalysisNative') as {
  prepareSquatVideoSeed: jest.Mock;
};

describe('importVideoAnalysisFromSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should persist seed preflight data and move the analysis to awaiting seed confirmation', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockResolvedValue({
      previewFramePath: '/tmp/preview.jpg',
      frameWidthPx: 1080,
      frameHeightPx: 1920,
      trackerVersion: 'opencv-hough-preflight-v1',
      candidates: [
        {
          id: 'candidate-1',
          x: 280,
          y: 320,
          radius: 180,
          score: 0.42,
        },
      ],
    });

    const addVideoAnalysis = jest.fn();
    const setVideoAnalysisStatus = jest.fn();
    const setManualSeedFramePath = jest.fn();
    const setSeedPreflight = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 7,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
    });

    expect(outcome).toBe('awaiting_seed_confirmation');
    expect(addVideoAnalysis.mock.calls).toEqual([
      [
        {
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
        },
      ],
    ]);
    expect(setVideoAnalysisStatus.mock.calls).toEqual([
      [7, VideoAnalysisStatus.PROCESSING],
      [7, VideoAnalysisStatus.AWAITING_SEED_CONFIRMATION],
    ]);
    expect(setSeedPreflight.mock.calls).toEqual([
      [
        7,
        '/tmp/preview.jpg',
        [
          {
            id: 'candidate-1',
            x: 280,
            y: 320,
            radius: 180,
            score: 0.42,
          },
        ],
        1080,
        1920,
        '/tmp/video.mp4',
      ],
    ]);
    expect(setManualSeedFramePath.mock.calls).toEqual([]);
  });

  it('should move the analysis to manual seed when native preprocessing requests it', async () => {
    copyImportedVideoToLocalStorage.mockResolvedValue('/tmp/video.mp4');
    prepareSquatVideoSeed.mockRejectedValue({
      code: 'ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED',
      message: 'MANUAL_SEED_REQUIRED::/tmp/manual-seed.jpg',
    });

    const addVideoAnalysis = jest.fn();
    const setVideoAnalysisStatus = jest.fn();
    const setManualSeedFramePath = jest.fn();
    const setSeedPreflight = jest.fn();

    const outcome = await importVideoAnalysisFromSource({
      analysisId: 9,
      sourceUri: 'content://video.mp4',
      addVideoAnalysis,
      setVideoAnalysisStatus,
      setManualSeedFramePath,
      setSeedPreflight,
    });

    expect(outcome).toBe('needs_manual_seed');
    expect(setVideoAnalysisStatus.mock.calls).toEqual([
      [9, VideoAnalysisStatus.PROCESSING],
      [9, VideoAnalysisStatus.NEEDS_MANUAL_SEED, 'Manual seed required'],
    ]);
    expect(setManualSeedFramePath.mock.calls).toEqual([[9, '/tmp/manual-seed.jpg', '/tmp/video.mp4']]);
    expect(setSeedPreflight.mock.calls).toEqual([]);
  });
});
