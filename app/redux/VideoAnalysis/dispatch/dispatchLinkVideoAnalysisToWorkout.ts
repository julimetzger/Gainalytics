import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchLinkVideoAnalysisToWorkout = () => {
  const dispatch = useDispatch();

  return (analysisId: number, workoutId: number, exerciseId?: number) =>
    dispatch({
      type: 'LINK_VIDEO_ANALYSIS_TO_WORKOUT',
      analysisId,
      workoutId,
      exerciseId,
    } as Action);
};
