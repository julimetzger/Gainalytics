import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const useDispatchAddSetToTraining = () => {
  const dispatch = useDispatch();

  return (workout: Workout, exercise: Exercise) =>
    dispatch({
      type: 'ADD_SET_TO_TRAINING',
      workout,
      exercise,
    } as Action);
};
