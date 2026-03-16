import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export const useVideoAnalysis = (analysisId?: number) =>
  useSelector((state: GlobalState) => (analysisId !== undefined ? state.videoAnalyses.byId[analysisId] : undefined));
