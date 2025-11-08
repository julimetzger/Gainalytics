import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchToggleShowPlusButtonLeft = () => {
  const dispatch = useDispatch();

  return () =>
    dispatch({
      type: 'SHOW_PLUS_BUTTON_LEFT',
    } as Action);
};
