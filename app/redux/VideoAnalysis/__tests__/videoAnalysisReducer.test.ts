import videoAnalysisReducer from '../videoAnalysisReducer';
import {SeedCandidate, VideoAnalysisStatus} from '../../../models/entities/VideoAnalysis';

describe('videoAnalysisReducer', () => {
  it('should add, update and remove a video analysis entry', () => {
    const afterAdd = videoAnalysisReducer(undefined, {
      type: 'ADD_VIDEO_ANALYSIS',
      videoAnalysis: {
        sourceUri: 'content://video.mp4',
        localVideoPath: '/tmp/video.mp4',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        status: VideoAnalysisStatus.QUEUED,
        videoMeta: {
          durationMs: 0,
          fps: 0,
          width: 0,
          height: 0,
        },
      },
    });

    const afterStatus = videoAnalysisReducer(afterAdd, {
      type: 'SET_VIDEO_ANALYSIS_STATUS',
      analysisId: 1,
      status: VideoAnalysisStatus.PROCESSING,
    });

    const afterAttach = videoAnalysisReducer(afterStatus, {
      type: 'ATTACH_VIDEO_ANALYSIS_RESULT',
      analysisId: 1,
      resultPath: '/tmp/results/analysis-1.json',
    });

    const afterDelete = videoAnalysisReducer(afterAttach, {
      type: 'DELETE_VIDEO_ANALYSIS',
      analysisId: 1,
    });

    expect(afterAdd).toEqual({
      byId: {
        1: {
          id: 1,
          sourceUri: 'content://video.mp4',
          localVideoPath: '/tmp/video.mp4',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          status: VideoAnalysisStatus.QUEUED,
          videoMeta: {
            durationMs: 0,
            fps: 0,
            width: 0,
            height: 0,
          },
        },
      },
      allIds: [1],
    });

    expect(afterStatus).toEqual({
      byId: {
        1: {
          id: 1,
          sourceUri: 'content://video.mp4',
          localVideoPath: '/tmp/video.mp4',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          status: VideoAnalysisStatus.PROCESSING,
          videoMeta: {
            durationMs: 0,
            fps: 0,
            width: 0,
            height: 0,
          },
          seedCandidates: undefined,
          seedFrameWidthPx: undefined,
          seedFrameHeightPx: undefined,
          error: undefined,
        },
      },
      allIds: [1],
    });

    expect(afterAttach).toEqual({
      byId: {
        1: {
          id: 1,
          sourceUri: 'content://video.mp4',
          localVideoPath: '/tmp/video.mp4',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          status: VideoAnalysisStatus.DONE,
          videoMeta: {
            durationMs: 0,
            fps: 0,
            width: 0,
            height: 0,
          },
          resultPath: '/tmp/results/analysis-1.json',
          manualSeedFramePath: undefined,
          seedCandidates: undefined,
          seedFrameWidthPx: undefined,
          seedFrameHeightPx: undefined,
          error: undefined,
        },
      },
      allIds: [1],
    });

    expect(afterDelete).toEqual({
      byId: {},
      allIds: [],
    });
  });

  it('should support workout linking with set index and manual seed frame path updates', () => {
    const baseState = videoAnalysisReducer(undefined, {
      type: 'ADD_VIDEO_ANALYSIS',
      videoAnalysis: {
        id: 5,
        sourceUri: 'content://video.mp4',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        status: VideoAnalysisStatus.QUEUED,
        videoMeta: {
          durationMs: 0,
          fps: 0,
          width: 0,
          height: 0,
        },
      },
    });

    const manualSeedState = videoAnalysisReducer(baseState, {
      type: 'SET_VIDEO_ANALYSIS_MANUAL_SEED_FRAME_PATH',
      analysisId: 5,
      manualSeedFramePath: '/tmp/manual-seed.jpg',
      localVideoPath: '/tmp/video.mp4',
    });

    const linkedState = videoAnalysisReducer(manualSeedState, {
      type: 'LINK_VIDEO_ANALYSIS_TO_WORKOUT',
      analysisId: 5,
      workoutId: 42,
      exerciseId: 11,
      setIndex: 3,
    });

    expect(linkedState).toEqual({
      byId: {
        5: {
          id: 5,
          sourceUri: 'content://video.mp4',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          status: VideoAnalysisStatus.QUEUED,
          videoMeta: {
            durationMs: 0,
            fps: 0,
            width: 0,
            height: 0,
          },
          manualSeedFramePath: '/tmp/manual-seed.jpg',
          localVideoPath: '/tmp/video.mp4',
          seedCandidates: undefined,
          seedFrameWidthPx: undefined,
          seedFrameHeightPx: undefined,
          workoutId: 42,
          exerciseId: 11,
          setIndex: 3,
        },
      },
      allIds: [5],
    });
  });

  it('should track analysisStartedAtMs and videoDurationMs in SET_VIDEO_ANALYSIS_STATUS', () => {
    const baseState = videoAnalysisReducer(undefined, {
      type: 'ADD_VIDEO_ANALYSIS',
      videoAnalysis: {
        id: 10,
        sourceUri: 'content://video.mp4',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        status: VideoAnalysisStatus.QUEUED,
        videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
      },
    });

    const processingState = videoAnalysisReducer(baseState, {
      type: 'SET_VIDEO_ANALYSIS_STATUS',
      analysisId: 10,
      status: VideoAnalysisStatus.PROCESSING,
      analysisStartedAtMs: 1700000000000,
      videoDurationMs: 6000,
    });

    expect(processingState.byId[10].status).toBe(VideoAnalysisStatus.PROCESSING);
    expect(processingState.byId[10].analysisStartedAtMs).toBe(1700000000000);
    expect(processingState.byId[10].videoDurationMs).toBe(6000);
  });

  it('should set FAILED status with error message for background analysis errors', () => {
    const baseState = videoAnalysisReducer(undefined, {
      type: 'ADD_VIDEO_ANALYSIS',
      videoAnalysis: {
        id: 11,
        sourceUri: 'content://video.mp4',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        status: VideoAnalysisStatus.PROCESSING,
        videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
      },
    });

    const failedState = videoAnalysisReducer(baseState, {
      type: 'SET_VIDEO_ANALYSIS_STATUS',
      analysisId: 11,
      status: VideoAnalysisStatus.FAILED,
      error: 'Background analysis failed',
    });

    expect(failedState.byId[11].status).toBe(VideoAnalysisStatus.FAILED);
    expect(failedState.byId[11].error).toBe('Background analysis failed');
  });

  it('should not include extra fields when not provided in SET_VIDEO_ANALYSIS_STATUS', () => {
    const baseState = videoAnalysisReducer(undefined, {
      type: 'ADD_VIDEO_ANALYSIS',
      videoAnalysis: {
        id: 12,
        sourceUri: 'content://video.mp4',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        status: VideoAnalysisStatus.QUEUED,
        videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
      },
    });

    const processingState = videoAnalysisReducer(baseState, {
      type: 'SET_VIDEO_ANALYSIS_STATUS',
      analysisId: 12,
      status: VideoAnalysisStatus.PROCESSING,
    });

    expect(processingState.byId[12].analysisStartedAtMs).toBeUndefined();
    expect(processingState.byId[12].videoDurationMs).toBeUndefined();
  });

  it('should persist seed preflight data and clear it when a result attaches', () => {
    const seedCandidates = [
      {
        id: 'candidate-1',
        normalizedX: 0.35,
        normalizedY: 0.41,
        normalizedWidth: 0.12,
        normalizedHeight: 0.08,
        score: 0.42,
      },
    ] satisfies SeedCandidate[];

    const baseState = videoAnalysisReducer(undefined, {
      type: 'ADD_VIDEO_ANALYSIS',
      videoAnalysis: {
        id: 7,
        sourceUri: 'content://video.mp4',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        status: VideoAnalysisStatus.PROCESSING,
        videoMeta: {
          durationMs: 0,
          fps: 0,
          width: 0,
          height: 0,
        },
      },
    });

    const preflightState = videoAnalysisReducer(baseState, {
      type: 'SET_VIDEO_ANALYSIS_SEED_PREFLIGHT',
      analysisId: 7,
      manualSeedFramePath: '/tmp/preflight.jpg',
      localVideoPath: '/tmp/video.mp4',
      seedCandidates,
      seedFrameWidthPx: 1080,
      seedFrameHeightPx: 1920,
    });

    const attachedState = videoAnalysisReducer(preflightState, {
      type: 'ATTACH_VIDEO_ANALYSIS_RESULT',
      analysisId: 7,
      resultPath: '/tmp/results/analysis-7.json',
    });

    expect(preflightState).toEqual({
      byId: {
        7: {
          id: 7,
          sourceUri: 'content://video.mp4',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          status: VideoAnalysisStatus.PROCESSING,
          videoMeta: {
            durationMs: 0,
            fps: 0,
            width: 0,
            height: 0,
          },
          manualSeedFramePath: '/tmp/preflight.jpg',
          localVideoPath: '/tmp/video.mp4',
          seedCandidates,
          seedFrameWidthPx: 1080,
          seedFrameHeightPx: 1920,
        },
      },
      allIds: [7],
    });

    expect(attachedState).toEqual({
      byId: {
        7: {
          id: 7,
          sourceUri: 'content://video.mp4',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          status: VideoAnalysisStatus.DONE,
          videoMeta: {
            durationMs: 0,
            fps: 0,
            width: 0,
            height: 0,
          },
          resultPath: '/tmp/results/analysis-7.json',
          localVideoPath: '/tmp/video.mp4',
          manualSeedFramePath: undefined,
          seedCandidates: undefined,
          seedFrameWidthPx: undefined,
          seedFrameHeightPx: undefined,
          error: undefined,
        },
      },
      allIds: [7],
    });
  });
});
