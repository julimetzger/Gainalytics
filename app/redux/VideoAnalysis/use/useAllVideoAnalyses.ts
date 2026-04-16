import {shallowEqual, useSelector} from 'react-redux';
import {VideoAnalysis} from '../../../models/entities/VideoAnalysis';
import {GlobalState} from '../../rootReducer';

export const useAllVideoAnalyses = () =>
  useSelector((state: GlobalState) => {
    return state.videoAnalyses.allIds
      .map((id) => state.videoAnalyses.byId[id])
      .sort((left: VideoAnalysis, right: VideoAnalysis) => {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, shallowEqual);
