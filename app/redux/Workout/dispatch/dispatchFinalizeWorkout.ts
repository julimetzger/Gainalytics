import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchFinalizeWorkout = () => {
  const dispatch = useDispatch();

  return (end: Date, workoutId: number) =>
    dispatch({
      type: 'FINALIZE_WORKOUT',
      end,
      workoutId,
    } as Action);
};
