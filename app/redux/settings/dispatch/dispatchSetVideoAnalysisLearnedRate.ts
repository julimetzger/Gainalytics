import {useDispatch} from 'react-redux';

export const dispatchSetVideoAnalysisLearnedRate = () => {
  const dispatch = useDispatch();
  return (rate: number) =>
    dispatch({type: 'SET_VIDEO_ANALYSIS_LEARNED_RATE', rate});
};
