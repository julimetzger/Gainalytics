import {PermissionsAndroid, Platform} from 'react-native';
import {VideoAnalysis, VideoAnalysisStatus} from '../models/entities/VideoAnalysis';
import {copyImportedVideoToLocalStorage} from './videoAnalysisStorage';
import {analyzeSquatVideo} from './videoAnalysisNative';

export const EMULATOR_SQUAT_VIDEO_PATH = '/storage/emulated/0/Pictures/PXL_20250917_171414039~2.mp4';

interface ImportVideoAnalysisParams {
  analysisId: number;
  sourceUri: string;
  addVideoAnalysis: (videoAnalysis: VideoAnalysis) => void;
  setVideoAnalysisStatus: (analysisId: number, status: VideoAnalysisStatus, error?: string) => void;
  attachVideoAnalysisResult: (analysisId: number, resultPath: string, localVideoPath?: string) => void;
}

export const importVideoAnalysisFromSource = async ({
  analysisId,
  sourceUri,
  addVideoAnalysis,
  setVideoAnalysisStatus,
  attachVideoAnalysisResult,
}: ImportVideoAnalysisParams) => {
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
    const localVideoPath = await copyImportedVideoToLocalStorage(sourceUri, analysisId);
    const resultPath = await analyzeSquatVideo(localVideoPath, analysisId);
    attachVideoAnalysisResult(analysisId, resultPath, localVideoPath);
  } catch (error) {
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
