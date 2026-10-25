import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {resolveAvailableMuscles, resolveOverviewMuscles} from '../../../utils/muscle-catalog';

const selectMuscleSettings = (state: GlobalState) => state.settings?.muscles;

/** GH-523: every muscle exercises can be assigned to (built-ins the user kept + the user's own). */
export const useAvailableMuscles = () => {
  const muscleSettings = useSelector(selectMuscleSettings);
  return useMemo(() => resolveAvailableMuscles(muscleSettings), [muscleSettings]);
};

/** GH-523: the available muscles the overviews (muscle map, radar, Muscle Overview) show. */
export const useOverviewMuscles = () => {
  const muscleSettings = useSelector(selectMuscleSettings);
  return useMemo(() => resolveOverviewMuscles(muscleSettings), [muscleSettings]);
};
