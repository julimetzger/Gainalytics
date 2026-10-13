import {useDispatch} from 'react-redux';
import {Action} from 'redux';

/** GH-518: makes a plan the current one (the starred plan driving the Training home dashboard). */
export const dispatchSetCurrentTrainingsPlan = () => {
  const dispatch = useDispatch();

  return (trainingsPlanId: number | undefined) =>
    dispatch({
      type: 'SET_CURRENT_TRAININGS_PLAN',
      trainingsPlanId,
    } as Action & {trainingsPlanId: number | undefined});
};
