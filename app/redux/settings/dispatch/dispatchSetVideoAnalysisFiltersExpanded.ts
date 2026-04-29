import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSetVideoAnalysisFiltersExpanded = () => {
  const dispatch = useDispatch();

  return (expanded: boolean) =>
    dispatch({
      type: 'SET_VIDEO_ANALYSIS_FILTERS_EXPANDED',
      expanded,
    } as Action & {expanded: boolean});
};
