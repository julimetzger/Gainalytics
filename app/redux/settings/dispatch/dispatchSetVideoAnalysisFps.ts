import {useDispatch} from 'react-redux';
import {VideoAnalysisFps} from '../../../models/VideoAnalysisFps';

// A hook (it calls useDispatch), hence use* instead of the older dispatch* naming.
export function useSetVideoAnalysisFps() {
  const dispatch = useDispatch();
  return (fps: VideoAnalysisFps) => {
    dispatch({type: 'SET_VIDEO_ANALYSIS_FPS', fps});
  };
}
