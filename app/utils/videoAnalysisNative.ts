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
    if (manualSeed) {
      try {
        return await nativeAnalyze(localVideoPath, analysisId, manualSeed);
      } catch (error) {
        if (!isArgumentMismatchError(error)) {
          throw error;
        }
        // Backward compatibility: older native build without manualSeed parameter.
        return nativeAnalyze(localVideoPath, analysisId);
      }
    }

    try {
      // Prefer legacy 2-parameter call for compatibility with older native builds.
      return await nativeAnalyze(localVideoPath, analysisId);
    } catch (error) {
      if (!isArgumentMismatchError(error)) {
        throw error;
      }
      // Newer native build requires explicit manualSeed argument.
      return nativeAnalyze(localVideoPath, analysisId, null);
    }
  }

  // Fallback keeps JS flow working if native module is unavailable (e.g., old build).
  return writeBarTrackingResultToFile(buildStubBarTrackingResult(analysisId));
};
