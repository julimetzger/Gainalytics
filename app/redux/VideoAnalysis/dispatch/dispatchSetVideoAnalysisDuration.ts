import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSetVideoAnalysisDuration = () => {
  const dispatch = useDispatch();

  return (analysisId: number, durationMs: number) =>
    dispatch({
      type: 'SET_VIDEO_ANALYSIS_DURATION',
      analysisId,
      durationMs,
    } as Action);
};
