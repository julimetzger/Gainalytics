import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchDeleteVideoAnalysis = () => {
  const dispatch = useDispatch();

  return (analysisId: number) =>
    dispatch({
      type: 'DELETE_VIDEO_ANALYSIS',
      analysisId,
    } as Action);
};
