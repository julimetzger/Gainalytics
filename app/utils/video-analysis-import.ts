import {PermissionsAndroid, Platform} from 'react-native';
import {VideoAnalysis, VideoAnalysisStatus} from '../models/entities/VideoAnalysis';
import {copyImportedVideoToLocalStorage} from './videoAnalysisStorage';
import {analyzeSquatVideo} from './videoAnalysisNative';

export const EMULATOR_SQUAT_VIDEO_PATH = '/storage/emulated/0/Pictures/PXL_20250917_171414039~2.mp4';
const MANUAL_SEED_REQUIRED_PREFIX = 'MANUAL_SEED_REQUIRED::';

export type VideoAnalysisImportOutcome = 'done' | 'needs_manual_seed';

interface ImportVideoAnalysisParams {
  analysisId: number;
  sourceUri: string;
  addVideoAnalysis: (videoAnalysis: VideoAnalysis) => void;
  setVideoAnalysisStatus: (analysisId: number, status: VideoAnalysisStatus, error?: string) => void;
  attachVideoAnalysisResult: (analysisId: number, resultPath: string, localVideoPath?: string) => void;
  setManualSeedFramePath: (analysisId: number, manualSeedFramePath?: string, localVideoPath?: string) => void;
}

const extractManualSeedFramePath = (message?: string) => {
  if (!message || !message.startsWith(MANUAL_SEED_REQUIRED_PREFIX)) {
    return undefined;
  }
  const path = message.substring(MANUAL_SEED_REQUIRED_PREFIX.length).trim();
  return path.length > 0 ? path : undefined;
};

export const importVideoAnalysisFromSource = async ({
  analysisId,
  sourceUri,
  addVideoAnalysis,
  setVideoAnalysisStatus,
  attachVideoAnalysisResult,
  setManualSeedFramePath,
}: ImportVideoAnalysisParams): Promise<VideoAnalysisImportOutcome> => {
  let localVideoPath: string | undefined;

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
    localVideoPath = await copyImportedVideoToLocalStorage(sourceUri, analysisId);
    const resultPath = await analyzeSquatVideo(localVideoPath, analysisId);
    attachVideoAnalysisResult(analysisId, resultPath, localVideoPath);
    return 'done';
  } catch (error) {
    const nativeError = error as {code?: string; message?: string};
    if (nativeError?.code === 'ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED') {
      const manualSeedFramePath = extractManualSeedFramePath(nativeError.message);
      setManualSeedFramePath(analysisId, manualSeedFramePath, localVideoPath);
      setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.NEEDS_MANUAL_SEED, 'Manual seed required');
      return 'needs_manual_seed';
    }
    setVideoAnalysisStatus(analysisId, VideoAnalysisStatus.FAILED, 'Import or preprocessing failed');
    throw error;
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
