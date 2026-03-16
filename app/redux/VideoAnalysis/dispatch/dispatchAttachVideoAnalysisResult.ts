import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchAttachVideoAnalysisResult = () => {
  const dispatch = useDispatch();

  return (analysisId: number, resultPath: string, localVideoPath?: string) =>
    dispatch({
      type: 'ATTACH_VIDEO_ANALYSIS_RESULT',
      analysisId,
      resultPath,
      localVideoPath,
    } as Action);
};
