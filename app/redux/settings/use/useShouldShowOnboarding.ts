import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

/**
 * GH-497: the onboarding opens on its own only for a store without any training data,
 * so an update never shows it to an existing user. Plans, trainings and logged
 * workouts count as data; the default exercises of a fresh install do not.
 */
export const selectShouldShowOnboarding = (state: GlobalState): boolean => {
  if (state.settings?.onboardingRequested) return true;
  if (state.settings?.onboardingCompleted) return false;
  const hasData =
    (state.trainingsPlan?.allIds?.length ?? 0) > 0 ||
    (state.trainings?.allIds?.length ?? 0) > 0 ||
    (state.workouts?.allIds?.length ?? 0) > 0;
  return !hasData;
};

export const useShouldShowOnboarding = () => useSelector(selectShouldShowOnboarding);
