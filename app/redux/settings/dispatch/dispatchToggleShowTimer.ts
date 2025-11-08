import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchToggleShowTimer = () => {
  const dispatch = useDispatch();

  return () =>
    dispatch({
      type: 'TOGGLE_DISABLE_TIMER',
    } as Action);
};
