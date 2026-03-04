import {NativeModules} from 'react-native';
import {buildStubBarTrackingResult, writeBarTrackingResultToFile} from './videoAnalysisStorage';

const {VideoAnalysis} = NativeModules;

export interface ManualSeedPayload {
  normalizedX: number;
  normalizedY: number;
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
