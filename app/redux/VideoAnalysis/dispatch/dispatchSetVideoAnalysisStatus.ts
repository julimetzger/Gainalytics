import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {VideoAnalysisStatus} from '../../../models/entities/VideoAnalysis';

export const dispatchSetVideoAnalysisStatus = () => {
  const dispatch = useDispatch();

  return (analysisId: number, status: VideoAnalysisStatus, error?: string, extra?: {analysisStartedAtMs?: number; videoDurationMs?: number}) =>
    dispatch({
      type: 'SET_VIDEO_ANALYSIS_STATUS',
      analysisId,
      status,
      error,
      ...extra,
    } as Action);
};
