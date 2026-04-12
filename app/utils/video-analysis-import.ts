import {PermissionsAndroid, Platform} from 'react-native';
import {VideoAnalysis, VideoAnalysisStatus} from '../models/entities/VideoAnalysis';
import {copyImportedVideoToLocalStorage} from './videoAnalysisStorage';
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

export const EMULATOR_SQUAT_VIDEO_PATH = '/sdcard/Android/data/com.powerliftingworkoutplanner/cache/squat_test.mp4';

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
  localVideoPath,
  manualSeed,
  videoDurationMs,
  importStartedAtMs,
  attachVideoAnalysisResult,
  setVideoAnalysisStatus,
}: {
  analysisId: number;
  localVideoPath: string;
  manualSeed: ManualSeedPayload;
  videoDurationMs: number;
  importStartedAtMs: number;
  attachVideoAnalysisResult: ImportVideoAnalysisParams['attachVideoAnalysisResult'];
  setVideoAnalysisStatus: ImportVideoAnalysisParams['setVideoAnalysisStatus'];
}) => {
  incrementActiveAnalysisCount();
  if (getActiveAnalysisCount() === 1) {
    startVideoAnalysisForegroundService();
  }

  analyzeSquatVideo(localVideoPath, analysisId, manualSeed)
    .then((resultPath) => {
      attachVideoAnalysisResult(analysisId, resultPath, localVideoPath);
      recordCompletedAnalysisRate(Date.now() - importStartedAtMs, videoDurationMs);
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
}: ImportVideoAnalysisParams): Promise<VideoAnalysisImportOutcome> => {
  const importStartedAtMs = Date.now();
  const sourceVideoDurationMs = await getVideoDuration(sourceUri);
  let localVideoPath: string | undefined;
  let videoDurationMs = sourceVideoDurationMs > 0 ? sourceVideoDurationMs : 0;
  let copyMs = 0;
  let preflightMs = 0;
  let outcome: VideoAnalysisImportOutcome | 'failed' = 'failed';

  // Request notification permission before analysis starts.
  // Permission errors must not block the analysis from starting.
  try {
    await requestVideoAnalysisNotificationPermission();
  } catch {
    // Non-fatal: analysis continues without notification support.
  }

  addVideoAnalysis({
    id: analysisId,
    sourceUri,
    createdAt: new Date(Date.now()),
    status: VideoAnalysisStatus.QUEUED,
    videoMeta: {
      durationMs: videoDurationMs,
      fps: 0,
      width: 0,
      height: 0,
    },
  });

  try {
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.PROCESSING);

    const copyStartedAtMs = Date.now();
    localVideoPath = await copyImportedVideoToLocalStorage(sourceUri, analysisId);
    copyMs = Date.now() - copyStartedAtMs;

    // Read actual video duration from file metadata.
    // Falls back to 0 (unknown) if the native module cannot determine it.
    const resolvedVideoDurationMs = await getVideoDuration(localVideoPath);
    if (resolvedVideoDurationMs > 0) {
      videoDurationMs = resolvedVideoDurationMs;
    }
    if (videoDurationMs > 0 && videoDurationMs !== sourceVideoDurationMs) {
      setVideoAnalysisDuration?.(analysisId, videoDurationMs);
    }

    const preflightStartedAtMs = Date.now();
    const preflight = await prepareSquatVideoSeed(localVideoPath, analysisId);
    preflightMs = Date.now() - preflightStartedAtMs;
    setSeedPreflight(
      analysisId,
      preflight.previewFramePath,
      preflight.candidates,
      preflight.frameWidthPx,
      preflight.frameHeightPx,
      localVideoPath,
    );

    const candidates = preflight.candidates ?? [];
    if (candidates.length === 0) {
      setManualSeedFramePath(analysisId, preflight.previewFramePath, localVideoPath);
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

    runBackgroundAnalysis({
      analysisId,
      localVideoPath,
      manualSeed: toManualSeedPayload(candidates[0]),
      videoDurationMs,
      importStartedAtMs,
      attachVideoAnalysisResult,
      setVideoAnalysisStatus,
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
        localVideoPath,
        outcome,
        copyMs,
        preflightMs,
        totalImportMs: Date.now() - importStartedAtMs,
      }),
    );
  }
};

export const requestVideoReadPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const sdkVersion = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const permission =
    sdkVersion >= 33 ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  if (!permission) {
    return true;
  }

  const hasPermission = await PermissionsAndroid.check(permission);
  if (hasPermission) {
    return true;
  }

  const status = await PermissionsAndroid.request(permission);
  return status === PermissionsAndroid.RESULTS.GRANTED;
};
