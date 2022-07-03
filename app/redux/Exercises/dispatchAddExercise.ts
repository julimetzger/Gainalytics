import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const useDispatchAddExercise = () => {
  const dispatch = useDispatch();

  return (nameOfExercise: String) =>
    dispatch({
      type: 'ADD_EXERCISE',
      nameOfExercise,
    } as Action);
};
