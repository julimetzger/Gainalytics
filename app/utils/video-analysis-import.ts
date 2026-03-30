import {PermissionsAndroid, Platform} from 'react-native';
import {VideoAnalysis, VideoAnalysisStatus} from '../models/entities/VideoAnalysis';
import {copyImportedVideoToLocalStorage} from './videoAnalysisStorage';
import {analyzeSquatVideo, getVideoDuration, ManualSeedPayload, prepareSquatVideoSeed, startVideoAnalysisForegroundService, stopVideoAnalysisForegroundService} from './videoAnalysisNative';
import {computeSecondsPerVideoSecond} from './videoAnalysisProgress';
import {requestVideoAnalysisNotificationPermission, showAnalysisCompleteNotification, showAnalysisFailedNotification} from './videoAnalysisNotification';

export const EMULATOR_SQUAT_VIDEO_PATH = '/storage/emulated/0/Pictures/PXL_20250917_171414039~2.mp4';

export type VideoAnalysisImportOutcome = 'awaiting_seed_selection' | 'done' | 'analysis_started' | 'failed_no_candidate';

interface ImportVideoAnalysisParams {
  analysisId: number;
  sourceUri: string;
  addVideoAnalysis: (videoAnalysis: VideoAnalysis) => void;
  setVideoAnalysisStatus: (analysisId: number, status: VideoAnalysisStatus, error?: string, extra?: {analysisStartedAtMs?: number; videoDurationMs?: number}) => void;
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
  setVideoAnalysisDuration: (analysisId: number, durationMs: number) => void;
  setLastAnalysisSecondsPerVideoSecond: (value: number) => void;
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

const runBackgroundAnalysis = (
  analysisId: number,
  localVideoPath: string,
  manualSeed: ManualSeedPayload,
  videoDurationMs: number,
  attachVideoAnalysisResult: ImportVideoAnalysisParams['attachVideoAnalysisResult'],
  setVideoAnalysisStatus: ImportVideoAnalysisParams['setVideoAnalysisStatus'],
  setLastAnalysisSecondsPerVideoSecond: ImportVideoAnalysisParams['setLastAnalysisSecondsPerVideoSecond'],
) => {
  const nativeAnalysisStartedAtMs = Date.now();

  startVideoAnalysisForegroundService();

  analyzeSquatVideo(localVideoPath, analysisId, manualSeed)
    .then((resultPath) => {
      const totalAnalysisMs = Date.now() - nativeAnalysisStartedAtMs;
      attachVideoAnalysisResult(analysisId, resultPath, localVideoPath);

      if (videoDurationMs > 0) {
        const rate = computeSecondsPerVideoSecond(totalAnalysisMs, videoDurationMs);
        setLastAnalysisSecondsPerVideoSecond(rate);
      }

      showAnalysisCompleteNotification(analysisId).catch(() => {});
    })
    .catch((error) => {
      console.error('[BackgroundVideoAnalysis] Analysis failed:', error);
      setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.FAILED, 'Background analysis failed');
      showAnalysisFailedNotification(analysisId).catch(() => {});
    })
    .finally(() => {
      stopVideoAnalysisForegroundService();
    });
};

export const importVideoAnalysisFromSource = async ({
  analysisId,
  sourceUri,
  addVideoAnalysis,
  setVideoAnalysisStatus,
  setManualSeedFramePath,
  setSeedPreflight,
  attachVideoAnalysisResult,
  setVideoAnalysisDuration,
  setLastAnalysisSecondsPerVideoSecond,
}: ImportVideoAnalysisParams): Promise<VideoAnalysisImportOutcome> => {
  const importStartedAtMs = Date.now();
  let localVideoPath: string | undefined;
  let copyMs = 0;
  let preflightMs = 0;
  let outcome: VideoAnalysisImportOutcome | 'failed' = 'failed';

  // Request notification permission before analysis starts.
  // Analysis continues regardless of whether permission is granted.
  await requestVideoAnalysisNotificationPermission();

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

  try {
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.PROCESSING);

    const copyStartedAtMs = Date.now();
    localVideoPath = await copyImportedVideoToLocalStorage(sourceUri, analysisId);
    copyMs = Date.now() - copyStartedAtMs;

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
      return 'failed_no_candidate';
    }

    if (candidates.length > 1) {
      setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.AWAITING_SEED_SELECTION);
      outcome = 'awaiting_seed_selection';
      return 'awaiting_seed_selection';
    }

    // Read actual video duration from file metadata.
    // Falls back to 0 (unknown) if the native module cannot determine it.
    const estimatedVideoDurationMs = await getVideoDuration(localVideoPath);
    if (estimatedVideoDurationMs > 0) {
      setVideoAnalysisDuration(analysisId, estimatedVideoDurationMs);
    }

    const analysisStartedAtMs = Date.now();
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.PROCESSING, undefined, {
      analysisStartedAtMs,
      videoDurationMs: estimatedVideoDurationMs,
    });

    runBackgroundAnalysis(
      analysisId,
      localVideoPath,
      toManualSeedPayload(candidates[0]),
      estimatedVideoDurationMs,
      attachVideoAnalysisResult,
      setVideoAnalysisStatus,
      setLastAnalysisSecondsPerVideoSecond,
    );

    outcome = 'analysis_started';
    return 'analysis_started';
  } catch (error) {
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.FAILED, 'Import or preprocessing failed');
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
