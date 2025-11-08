import {Action} from 'redux';
import {useDispatch} from 'react-redux';

export const dispatchDeleteExercise = () => {
  const dispatch = useDispatch();

  return (exerciseId: number) =>
    dispatch({
      type: 'DELETE_EXERCISE',
      exerciseId,
    } as Action);
};
