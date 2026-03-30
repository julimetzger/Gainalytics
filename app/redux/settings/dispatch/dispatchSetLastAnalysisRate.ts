import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSetLastAnalysisRate = () => {
  const dispatch = useDispatch();

  return (value: number) =>
    dispatch({
      type: 'SET_LAST_ANALYSIS_SECONDS_PER_VIDEO_SECOND',
      value,
    } as Action);
};
