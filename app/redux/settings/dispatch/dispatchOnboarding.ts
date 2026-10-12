import {useDispatch} from 'react-redux';
import {Action} from 'redux';

/** GH-497: marks the onboarding as finished (completed or skipped). */
export const dispatchCompleteOnboarding = () => {
  const dispatch = useDispatch();

  return () =>
    dispatch({
      type: 'COMPLETE_ONBOARDING',
    } as Action);
};

/** GH-497: reopens the onboarding from the Settings. */
export const dispatchShowOnboarding = () => {
  const dispatch = useDispatch();

  return () =>
    dispatch({
      type: 'SHOW_ONBOARDING',
    } as Action);
};
