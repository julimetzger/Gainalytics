import {useDispatch} from 'react-redux';
import {VideoAnalysisFps} from '../../../models/VideoAnalysisFps';

export function dispatchSetVideoAnalysisFps() {
  const dispatch = useDispatch();
  return (fps: VideoAnalysisFps) => {
    dispatch({type: 'SET_VIDEO_ANALYSIS_FPS', fps});
  };
}
