import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const useDispatchAddSetToTraining = () => {
  const dispatch = useDispatch();

  return (workout: Workout) =>
    dispatch({
      type: 'ADD_WORKOUT',
      workout
    } as Action);
};
