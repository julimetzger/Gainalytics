import {useDispatch} from 'react-redux';
import {Action} from 'redux';

/**
 * Records that the video now lives in app-private storage ("full import", GH-321).
 * From then on playback no longer depends on the gallery.
 */
export const dispatchSetVideoAnalysisLocalVideoPath = () => {
  const dispatch = useDispatch();

  return (analysisId: number, localVideoPath: string) =>
    dispatch({
      type: 'SET_VIDEO_ANALYSIS_LOCAL_VIDEO_PATH',
      analysisId,
      localVideoPath,
    } as Action);
};
