import {NativeModules} from 'react-native';
import {buildStubBarTrackingResult, writeBarTrackingResultToFile} from './videoAnalysisStorage';

const {VideoAnalysis} = NativeModules;

export const analyzeSquatVideo = async (localVideoPath: string, analysisId: number) => {
  if (VideoAnalysis?.analyzeSquatVideo) {
    return VideoAnalysis.analyzeSquatVideo(localVideoPath, analysisId);
  }

  // Fallback keeps JS flow working if native module is unavailable (e.g., old build).
  return writeBarTrackingResultToFile(buildStubBarTrackingResult(analysisId));
};
