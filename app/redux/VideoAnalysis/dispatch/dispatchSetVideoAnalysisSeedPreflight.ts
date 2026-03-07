import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {SeedCandidate} from '../../../models/entities/VideoAnalysis';

export const dispatchSetVideoAnalysisSeedPreflight = () => {
  const dispatch = useDispatch();

  return (
    analysisId: number,
    manualSeedFramePath?: string,
    seedCandidates?: SeedCandidate[],
    seedFrameWidthPx?: number,
    seedFrameHeightPx?: number,
    localVideoPath?: string,
  ) =>
    dispatch({
      type: 'SET_VIDEO_ANALYSIS_SEED_PREFLIGHT',
      analysisId,
      manualSeedFramePath,
      seedCandidates,
      seedFrameWidthPx,
      seedFrameHeightPx,
      localVideoPath,
    } as Action);
};
