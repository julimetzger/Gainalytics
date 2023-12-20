import {useDispatch} from 'react-redux';
import {Action} from 'redux';


/**
 * add fully build workout to redux store
 */
export const useDispatchAddSetToTraining = () => {
  const dispatch = useDispatch();

  return (workout: Workout) =>
    dispatch({
      type: 'ADD_WORKOUT',
      workout
    } as Action);
};
