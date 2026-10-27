import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {resolveVideoAnalysisFps, VideoAnalysisFps} from '../../../models/VideoAnalysisFps';

export function useVideoAnalysisFps(): VideoAnalysisFps {
  const stored = useSelector((state: GlobalState) => state.settings?.videoAnalysisFps);
  return resolveVideoAnalysisFps(stored);
}
