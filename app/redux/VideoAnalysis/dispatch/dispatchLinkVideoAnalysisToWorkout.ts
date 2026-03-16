import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchLinkVideoAnalysisToWorkout = () => {
  const dispatch = useDispatch();

  return (analysisId: number, workoutId: number, exerciseId?: number, setIndex?: number) =>
    dispatch({
      type: 'LINK_VIDEO_ANALYSIS_TO_WORKOUT',
      analysisId,
      workoutId,
      exerciseId,
      setIndex,
    } as Action);
};
