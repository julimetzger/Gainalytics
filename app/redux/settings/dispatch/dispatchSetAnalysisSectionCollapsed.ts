import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {AnalysisSectionId} from '../settingsReducer';

export const dispatchSetAnalysisSectionCollapsed = () => {
  const dispatch = useDispatch();

  return (section: AnalysisSectionId, collapsed: boolean) =>
    dispatch({
      type: 'SET_ANALYSIS_SECTION_COLLAPSED',
      section,
      collapsed,
    } as Action & {section: AnalysisSectionId; collapsed: boolean});
};
