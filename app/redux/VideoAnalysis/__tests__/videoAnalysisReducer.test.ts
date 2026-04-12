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

  it('RECOVER_STALE_VIDEO_ANALYSES sets in-progress analyses to FAILED and leaves terminal states unchanged', () => {
    const makeAnalysis = (id: number, status: VideoAnalysisStatus) => ({
      id,
      sourceUri: 'content://video.mp4',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      status,
      videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
    });

    const state = {
      byId: {
        1: makeAnalysis(1, VideoAnalysisStatus.QUEUED),
        2: makeAnalysis(2, VideoAnalysisStatus.COPYING),
        3: makeAnalysis(3, VideoAnalysisStatus.PREFLIGHT),
        4: makeAnalysis(4, VideoAnalysisStatus.PROCESSING),
        5: makeAnalysis(5, VideoAnalysisStatus.AWAITING_SEED_SELECTION),
        6: makeAnalysis(6, VideoAnalysisStatus.DONE),
        7: makeAnalysis(7, VideoAnalysisStatus.FAILED),
      },
      allIds: [1, 2, 3, 4, 5, 6, 7],
    };

    const recovered = videoAnalysisReducer(state, {type: 'RECOVER_STALE_VIDEO_ANALYSES'});

    expect(recovered.byId[1].status).toBe(VideoAnalysisStatus.FAILED);
    expect(recovered.byId[2].status).toBe(VideoAnalysisStatus.FAILED);
    expect(recovered.byId[3].status).toBe(VideoAnalysisStatus.FAILED);
    expect(recovered.byId[4].status).toBe(VideoAnalysisStatus.FAILED);
    // Terminal and user-interactive states are untouched
    expect(recovered.byId[5].status).toBe(VideoAnalysisStatus.AWAITING_SEED_SELECTION);
    expect(recovered.byId[6].status).toBe(VideoAnalysisStatus.DONE);
    expect(recovered.byId[7].status).toBe(VideoAnalysisStatus.FAILED);
    expect(recovered.allIds).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('RECOVER_STALE_VIDEO_ANALYSES returns the same state reference when nothing changes', () => {
    const state = {
      byId: {
        1: {
          id: 1,
          sourceUri: 'content://video.mp4',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          status: VideoAnalysisStatus.DONE,
          videoMeta: {durationMs: 0, fps: 0, width: 0, height: 0},
        },
      },
      allIds: [1],
    };

    const recovered = videoAnalysisReducer(state, {type: 'RECOVER_STALE_VIDEO_ANALYSES'});
    expect(recovered).toBe(state);
  });
});
