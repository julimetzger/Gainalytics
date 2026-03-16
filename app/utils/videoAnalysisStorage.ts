import RNFS from 'react-native-fs';
import {BarTrackingResult} from '../models/entities/VideoAnalysis';
import {buildSyntheticBarTrackingResult} from './video-analysis-synthetic';

const VIDEO_ANALYSIS_ROOT = `${RNFS.DocumentDirectoryPath}/video-analysis`;
const VIDEO_RESULTS_DIR = `${VIDEO_ANALYSIS_ROOT}/results`;
const VIDEO_SOURCE_DIR = `${VIDEO_ANALYSIS_ROOT}/videos`;
const VIDEO_PREVIEW_DIR = `${VIDEO_ANALYSIS_ROOT}/previews`;

const ensureDir = async (dirPath: string) => {
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    await RNFS.mkdir(dirPath);
  }
};

const normalizePath = (uriOrPath: string) => {
  return uriOrPath.startsWith('file://') ? uriOrPath.replace('file://', '') : uriOrPath;
};

const inferExtension = (path: string) => {
  const normalized = normalizePath(path);
  const extension = normalized.split('.').pop();
  if (!extension || extension.length > 5) {
    return 'mp4';
  }
  return extension;
};

export const copyImportedVideoToLocalStorage = async (uriOrPath: string, analysisId: number) => {
  await ensureDir(VIDEO_ANALYSIS_ROOT);
  await ensureDir(VIDEO_SOURCE_DIR);
  const extension = inferExtension(uriOrPath);
  const targetPath = `${VIDEO_SOURCE_DIR}/analysis-${analysisId}-${Date.now()}.${extension}`;
  await RNFS.copyFile(normalizePath(uriOrPath), targetPath);
  return targetPath;
};

export const writeBarTrackingResultToFile = async (result: BarTrackingResult) => {
  await ensureDir(VIDEO_ANALYSIS_ROOT);
  await ensureDir(VIDEO_RESULTS_DIR);
  const path = `${VIDEO_RESULTS_DIR}/analysis-${result.analysisId}.json`;
  await RNFS.writeFile(path, JSON.stringify(result, null, 2), 'utf8');
  return path;
};

export const readBarTrackingResultFromFile = async (path?: string) => {
  if (!path) {
    return undefined;
  }

  const exists = await RNFS.exists(path);
  if (!exists) {
    return undefined;
  }

  const content = await RNFS.readFile(path, 'utf8');
  return JSON.parse(content) as BarTrackingResult;
};

export const getVideoAnalysisPreviewPath = (analysisId: number) => {
  return `${VIDEO_PREVIEW_DIR}/analysis-${analysisId}.jpg`;
};

export const deleteVideoAnalysisArtifacts = async (paths: {resultPath?: string; localVideoPath?: string; previewPath?: string}) => {
  const allPaths = [paths.resultPath, paths.localVideoPath, paths.previewPath].filter((path): path is string => !!path);

  for (const path of allPaths) {
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
  }
};

export const buildStubBarTrackingResult = (analysisId: number): BarTrackingResult => {
  return buildSyntheticBarTrackingResult(analysisId);
};
