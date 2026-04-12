import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSetVideoAnalysisMetersPerPixel = () => {
  const dispatch = useDispatch();

  return (analysisId: number, metersPerPixel: number) =>
    dispatch({
      type: 'SET_VIDEO_ANALYSIS_METERS_PER_PIXEL',
      analysisId,
      metersPerPixel,
    } as Action);
};
