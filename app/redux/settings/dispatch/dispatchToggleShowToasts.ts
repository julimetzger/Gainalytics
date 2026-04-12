import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchToggleShowToasts = () => {
  const dispatch = useDispatch();

  return () =>
    dispatch({
      type: 'TOGGLE_DISABLE_TOASTS',
    } as Action);
};
