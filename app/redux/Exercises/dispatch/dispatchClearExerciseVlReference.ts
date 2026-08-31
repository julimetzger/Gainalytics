import {Action} from 'redux';
import {useDispatch} from 'react-redux';

export const dispatchClearExerciseVlReference = () => {
  const dispatch = useDispatch();

  return (exerciseId: number) =>
    dispatch({
      type: 'CLEAR_EXERCISE_VL_REFERENCE',
      exerciseId,
    } as Action);
};
