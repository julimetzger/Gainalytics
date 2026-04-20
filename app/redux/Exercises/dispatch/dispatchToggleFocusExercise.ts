import {Action} from 'redux';
import {useDispatch} from 'react-redux';

export const dispatchToggleFocusExercise = () => {
  const dispatch = useDispatch();

  return (exerciseId: number) =>
    dispatch({
      type: 'TOGGLE_FOCUS_EXERCISE',
      exerciseId,
    } as Action);
};
