import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {VideoAnalysisSetResult} from '../../../models/entities/VideoAnalysis';

export const dispatchSaveVideoAnalysisSetResult = () => {
  const dispatch = useDispatch();

  return (analysisId: number, setResult: VideoAnalysisSetResult) =>
    dispatch({
      type: 'SAVE_VIDEO_ANALYSIS_SET_RESULT',
      analysisId,
      setResult,
    } as Action);
};
