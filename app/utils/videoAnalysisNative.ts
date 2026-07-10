import {NativeModules, Platform} from 'react-native';
import {buildStubBarTrackingResult, writeBarTrackingResultToFile} from './videoAnalysisStorage';
import {SeedCandidate} from '../models/entities/VideoAnalysis';

const {VideoAnalysis} = NativeModules;

const normalizeVideoPath = (path: string) => {
  return path.startsWith('file://') ? path.replace('file://', '') : path;
};

export interface ManualSeedPayload {
  candidateId?: string;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
}

export interface SeedPreflightResult {
  previewFramePath: string;
  frameWidthPx: number;
  frameHeightPx: number;
  candidates: SeedCandidate[];
  trackerVersion: string;
}

const isArgumentMismatchError = (error: unknown) => {
  const nativeError = error as {message?: string};
  const message = (nativeError?.message ?? '').toLowerCase();
  return (
    message.includes('argument') ||
    message.includes('expected') ||
    message.includes('expects') ||
    message.includes('arity') ||
    message.includes('parameter')
  );
};

export const analyzeSquatVideo = async (localVideoPath: string, analysisId: number, manualSeed?: ManualSeedPayload) => {
  const nativeAnalyze = VideoAnalysis?.analyzeSquatVideo as undefined | ((...args: unknown[]) => Promise<string>);
  if (nativeAnalyze) {
    try {
      // Prefer modern 3-parameter call to avoid bridge arity errors on current native builds.
      return await nativeAnalyze(localVideoPath, analysisId, manualSeed ?? null);
    } catch (error) {
      if (!isArgumentMismatchError(error)) {
        throw error;
      }
      // Backward compatibility: older native build without manualSeed parameter.
      return nativeAnalyze(localVideoPath, analysisId);
    }
  }

  // Fallback keeps JS flow working if native module is unavailable (e.g., old build).
  return writeBarTrackingResultToFile(buildStubBarTrackingResult(analysisId));
};

export const migrateBarTrackingResultIfNeeded = async (resultPath?: string) => {
  if (!resultPath) {
    return undefined;
  }

  const nativeMigrate = VideoAnalysis?.migrateBarTrackingResultIfNeeded as undefined | ((path: string) => Promise<string>);
  if (!nativeMigrate) {
    return resultPath;
  }

  try {
    return await nativeMigrate(resultPath);
  } catch {
    return resultPath;
  }
};

/**
 * Returns the video duration in milliseconds.
 * Falls back to 0 when the native module is unavailable or metadata cannot be read.
 */
export const getVideoDuration = async (localVideoPath: string): Promise<number> => {
  const nativeGetDuration = VideoAnalysis?.getVideoDuration as undefined | ((path: string) => Promise<number>);
  if (!nativeGetDuration) {
    return 0;
  }
  try {
    return await nativeGetDuration(normalizeVideoPath(localVideoPath));
  } catch {
    return 0;
  }
};

export const prepareSquatVideoSeed = async (localVideoPath: string, analysisId: number): Promise<SeedPreflightResult> => {
  const nativePrepare = VideoAnalysis?.prepareSquatVideoSeed as undefined | ((...args: unknown[]) => Promise<SeedPreflightResult>);
  if (!nativePrepare) {
    throw new Error('Native prepareSquatVideoSeed is unavailable');
  }
  return nativePrepare(localVideoPath, analysisId);
};

export interface PickedVideo {
  uri: string;
  /** False when the provider refused a persistable grant (access then ends with the process). */
  persisted: boolean;
}

/**
 * Opens the system document picker and takes a persistable read grant on the result, so the
 * gallery video stays playable after the app is fully restarted. Resolves null on cancel.
 */
export const pickVideoFromGallery = async (): Promise<PickedVideo | null> => {
  const nativePick = VideoAnalysis?.pickVideoFromGallery as undefined | (() => Promise<PickedVideo | null>);
  if (!nativePick) {
    throw new Error('Native pickVideoFromGallery is unavailable');
  }
  return nativePick();
};

/** Gives back the persistable read grant, e.g. when the analysis is deleted. */
export const releaseVideoUriPermission = async (uri?: string): Promise<boolean> => {
  const nativeRelease = VideoAnalysis?.releaseVideoUriPermission as undefined | ((uri: string) => Promise<boolean>);
  if (!nativeRelease || !uri) {
    return false;
  }
  try {
    return await nativeRelease(uri);
  } catch {
    return false;
  }
};

/** False when the gallery video was deleted or the grant was revoked. */
export const isVideoSourceAvailable = async (pathOrUri?: string): Promise<boolean> => {
  const nativeCheck = VideoAnalysis?.isVideoSourceAvailable as undefined | ((path: string) => Promise<boolean>);
  if (!pathOrUri) {
    return false;
  }
  if (!nativeCheck) {
    return true;
  }
  try {
    return await nativeCheck(pathOrUri);
  } catch {
    return false;
  }
};

/** "Full import": copies the gallery video into app-private storage. Returns the local path. */
export const copyVideoToAppStorage = async (pathOrUri: string, analysisId: number): Promise<string> => {
  const nativeCopy = VideoAnalysis?.copyVideoToAppStorage as undefined | ((path: string, id: number) => Promise<string>);
  if (!nativeCopy) {
    throw new Error('Native copyVideoToAppStorage is unavailable');
  }
  return nativeCopy(pathOrUri, analysisId);
};

export const startVideoAnalysisForegroundService = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  const start = VideoAnalysis?.startForegroundService as undefined | (() => void);
  start?.();
};

export const stopVideoAnalysisForegroundService = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  const stop = VideoAnalysis?.stopForegroundService as undefined | (() => void);
  stop?.();
};
