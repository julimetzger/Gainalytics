import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSetExactAlarmPermission = () => {
  const dispatch = useDispatch();

  return (hasPermission: boolean) =>
    dispatch({
      type: 'SET_EXACT_ALARM_PERMISSION',
      hasPermission: hasPermission,
    } as Action);
};
