import {NativeModules, Platform} from 'react-native';
import {buildStubBarTrackingResult, writeBarTrackingResultToFile} from './videoAnalysisStorage';
import {BarTrackingResult, SeedCandidate} from '../models/entities/VideoAnalysis';

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

export const getVideoRotationDegrees = async (localVideoPath: string): Promise<number> => {
  const nativeGetRotation = VideoAnalysis?.getVideoRotationDegrees as undefined | ((path: string) => Promise<number>);
  if (!nativeGetRotation) {
    return 0;
  }
  try {
    return nativeGetRotation(normalizeVideoPath(localVideoPath));
  } catch {
    return 0;
  }
};

export const attachVideoRotationToResult = async (
  result: BarTrackingResult | undefined,
  localVideoPath?: string,
): Promise<BarTrackingResult | undefined> => {
  if (!result || !localVideoPath) {
    return result;
  }
  const videoRotationDegrees = result.analysisMeta.videoRotationDegrees ?? await getVideoRotationDegrees(localVideoPath);
  return {
    ...result,
    analysisMeta: {
      ...result.analysisMeta,
      videoRotationDegrees,
    },
  };
};

export const prepareSquatVideoSeed = async (localVideoPath: string, analysisId: number): Promise<SeedPreflightResult> => {
  const nativePrepare = VideoAnalysis?.prepareSquatVideoSeed as undefined | ((...args: unknown[]) => Promise<SeedPreflightResult>);
  if (!nativePrepare) {
    throw new Error('Native prepareSquatVideoSeed is unavailable');
  }
  return nativePrepare(localVideoPath, analysisId);
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
