import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {VideoAnalysis} from '../../../models/entities/VideoAnalysis';

export const dispatchAddVideoAnalysis = () => {
  const dispatch = useDispatch();

  return (videoAnalysis: VideoAnalysis) =>
    dispatch({
      type: 'ADD_VIDEO_ANALYSIS',
      videoAnalysis,
    } as Action);
};
