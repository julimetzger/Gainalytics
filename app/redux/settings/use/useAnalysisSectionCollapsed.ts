import {useSettings} from './useSettings';
import {dispatchSetAnalysisSectionCollapsed} from '../dispatch/dispatchSetAnalysisSectionCollapsed';
import {AnalysisSectionId} from '../settingsReducer';

/** Persisted collapsed/expanded state for a Muscle Groups / Muscle Map / Metrics analysis section. */
export const useAnalysisSectionCollapsed = (section: AnalysisSectionId): [boolean, () => void] => {
  const settings = useSettings();
  const setCollapsed = dispatchSetAnalysisSectionCollapsed();
  const collapsed = settings?.analysisSectionsCollapsed?.[section] ?? false;

  return [collapsed, () => setCollapsed(section, !collapsed)];
};
