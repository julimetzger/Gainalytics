import {VideoAnalysis, VideoAnalysisStatus} from '../models/entities/VideoAnalysis';
import {
  analyzeSquatVideo,
  getVideoDuration,
  ManualSeedPayload,
  prepareSquatVideoSeed,
  startVideoAnalysisForegroundService,
  stopVideoAnalysisForegroundService,
} from './videoAnalysisNative';
import {
  postVideoAnalysisCompleteNotification,
  postVideoAnalysisFailedNotification,
  requestVideoAnalysisNotificationPermission,
} from './videoAnalysisNotification';
import {
  decrementActiveAnalysisCount,
  getActiveAnalysisCount,
  incrementActiveAnalysisCount,
  recordCompletedAnalysisRate,
  shouldStopForegroundService,
} from './videoAnalysisProgress';

/** Known plate diameter in metres (outer plate, 45 kg / standard Olympic plate). */
export const PLATE_DIAMETER_M = 0.45;

/**
 * Compute metersPerPixel from a seed candidate's normalised width and the frame width in pixels.
 * Returns null when the computed plate width is zero (cannot calibrate).
 */
export const calibrateFromSeed = (
  normalizedWidth: number,
  frameWidthPx: number,
): number | null => {
  const plateWidthPx = normalizedWidth * frameWidthPx;
  if (plateWidthPx <= 0) {
    return null;
  }
  return PLATE_DIAMETER_M / plateWidthPx;
};

export type VideoAnalysisImportOutcome = 'awaiting_seed_selection' | 'analysis_started' | 'failed_no_candidate';

interface ImportVideoAnalysisParams {
  analysisId: number;
  sourceUri: string;
  addVideoAnalysis: (videoAnalysis: VideoAnalysis) => void;
  setVideoAnalysisStatus: (analysisId: number, status: VideoAnalysisStatus, error?: string) => void;
  setVideoAnalysisDuration?: (analysisId: number, durationMs: number) => void;
  setManualSeedFramePath: (analysisId: number, manualSeedFramePath?: string, localVideoPath?: string) => void;
  setSeedPreflight: (
    analysisId: number,
    manualSeedFramePath?: string,
    seedCandidates?: VideoAnalysis['seedCandidates'],
    seedFrameWidthPx?: number,
    seedFrameHeightPx?: number,
    localVideoPath?: string,
  ) => void;
  attachVideoAnalysisResult: (analysisId: number, resultPath: string, localVideoPath?: string) => void;
  setMetersPerPixel?: (analysisId: number, metersPerPixel: number) => void;
  onRateUpdated?: (rate: number) => void;
}

const toManualSeedPayload = (candidate: NonNullable<VideoAnalysis['seedCandidates']>[number]): ManualSeedPayload => {
  return {
    candidateId: candidate.id,
    normalizedX: candidate.normalizedX,
    normalizedY: candidate.normalizedY,
    normalizedWidth: candidate.normalizedWidth,
    normalizedHeight: candidate.normalizedHeight,
  };
};

const runBackgroundAnalysis = ({
  analysisId,
  videoUri,
  manualSeed,
  videoDurationMs,
  importStartedAtMs,
  attachVideoAnalysisResult,
  setVideoAnalysisStatus,
  onRateUpdated,
}: {
  analysisId: number;
  /** Gallery content:// URI, or an app-private path for pre-GH-321 analyses. */
  videoUri: string;
  manualSeed: ManualSeedPayload;
  videoDurationMs: number;
  importStartedAtMs: number;
  attachVideoAnalysisResult: ImportVideoAnalysisParams['attachVideoAnalysisResult'];
  setVideoAnalysisStatus: ImportVideoAnalysisParams['setVideoAnalysisStatus'];
  onRateUpdated?: (rate: number) => void;
}) => {
  incrementActiveAnalysisCount();
  if (getActiveAnalysisCount() === 1) {
    startVideoAnalysisForegroundService();
  }

  analyzeSquatVideo(videoUri, analysisId, manualSeed)
    .then((resultPath) => {
      // No localVideoPath: the video stays in the gallery until the user secures it.
      attachVideoAnalysisResult(analysisId, resultPath);
      // Only persist a learned rate when we actually measured one. With
      // videoDurationMs <= 0 (metadata read failed) recordCompletedAnalysisRate
      // returns the in-memory default and would clobber the previously
      // persisted rate after an app restart.
      if (videoDurationMs > 0) {
        const newRate = recordCompletedAnalysisRate(Date.now() - importStartedAtMs, videoDurationMs);
        onRateUpdated?.(newRate);
      }
      postVideoAnalysisCompleteNotification(analysisId).catch(() => {});
    })
    .catch((error) => {
      console.error('[BackgroundVideoAnalysis] Analysis failed:', error);
      setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.FAILED, 'Background analysis failed');
      postVideoAnalysisFailedNotification(analysisId).catch(() => {});
    })
    .finally(() => {
      decrementActiveAnalysisCount();
      if (shouldStopForegroundService()) {
        stopVideoAnalysisForegroundService();
      }
    });
};

export const importVideoAnalysisFromSource = async ({
  analysisId,
  sourceUri,
  addVideoAnalysis,
  setVideoAnalysisStatus,
  setVideoAnalysisDuration,
  setManualSeedFramePath,
  setSeedPreflight,
  attachVideoAnalysisResult,
  setMetersPerPixel,
  onRateUpdated,
}: ImportVideoAnalysisParams): Promise<VideoAnalysisImportOutcome> => {
  const importStartedAtMs = Date.now();
  let videoDurationMs = 0;
  let preflightMs = 0;
  let outcome: VideoAnalysisImportOutcome | 'failed' = 'failed';

  // Add the card to the list IMMEDIATELY — before any async work.
  // This ensures the card appears < 1 s after the user taps Import.
  addVideoAnalysis({
    id: analysisId,
    sourceUri,
    createdAt: new Date(Date.now()),
    status: VideoAnalysisStatus.QUEUED,
    videoMeta: {
      durationMs: 0,
      fps: 0,
      width: 0,
      height: 0,
    },
  });

  // Request notification permission in the background — must not block the import flow.
  requestVideoAnalysisNotificationPermission().catch(() => {});

  try {
    // GH-321: the video is NOT copied into the app. Preflight and analysis read the
    // gallery URI directly, which also removes the two copies the old flow paid for.
    // `localVideoPath` stays undefined until the user explicitly secures the video.
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.PREFLIGHT);

    const sourceVideoDurationMs = await getVideoDuration(sourceUri);
    if (sourceVideoDurationMs > 0) {
      videoDurationMs = sourceVideoDurationMs;
      setVideoAnalysisDuration?.(analysisId, sourceVideoDurationMs);
    }

    const preflightStartedAtMs = Date.now();
    const preflight = await prepareSquatVideoSeed(sourceUri, analysisId);
    preflightMs = Date.now() - preflightStartedAtMs;
    setSeedPreflight(
      analysisId,
      preflight.previewFramePath,
      preflight.candidates,
      preflight.frameWidthPx,
      preflight.frameHeightPx,
    );

    const candidates = preflight.candidates ?? [];
    if (candidates.length === 0) {
      setManualSeedFramePath(analysisId, preflight.previewFramePath);
      setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.FAILED, 'No outer plate candidate found at t=0');
      outcome = 'failed_no_candidate';
      postVideoAnalysisFailedNotification(analysisId).catch(() => {});
      return 'failed_no_candidate';
    }

    if (candidates.length > 1) {
      setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.AWAITING_SEED_SELECTION);
      outcome = 'awaiting_seed_selection';
      return 'awaiting_seed_selection';
    }

    const mpp = calibrateFromSeed(candidates[0].normalizedWidth, preflight.frameWidthPx ?? 0);
    if (mpp != null && setMetersPerPixel) {
      setMetersPerPixel(analysisId, mpp);
    }
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.PROCESSING);
    runBackgroundAnalysis({
      analysisId,
      videoUri: sourceUri,
      manualSeed: toManualSeedPayload(candidates[0]),
      videoDurationMs,
      importStartedAtMs,
      attachVideoAnalysisResult,
      setVideoAnalysisStatus,
      onRateUpdated,
    });

    outcome = 'analysis_started';
    return 'analysis_started';
  } catch (error) {
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.FAILED, 'Import or preprocessing failed');
    postVideoAnalysisFailedNotification(analysisId).catch(() => {});
    throw error;
  } finally {
    console.info(
      '[VideoAnalysisImportMetrics]',
      JSON.stringify({
        analysisId,
        sourceUri,
        outcome,
        preflightMs,
        totalImportMs: Date.now() - importStartedAtMs,
      }),
    );
  }
};
