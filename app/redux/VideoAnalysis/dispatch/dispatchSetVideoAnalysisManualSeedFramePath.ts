import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSetVideoAnalysisManualSeedFramePath = () => {
  const dispatch = useDispatch();

  return (analysisId: number, manualSeedFramePath?: string, localVideoPath?: string) =>
    dispatch({
      type: 'SET_VIDEO_ANALYSIS_MANUAL_SEED_FRAME_PATH',
      analysisId,
      manualSeedFramePath,
      localVideoPath,
    } as Action);
};
