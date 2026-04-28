import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchSetRestTimerUserDefault = () => {
  const dispatch = useDispatch();
  return (seconds: number) =>
    dispatch({
      type: 'SET_REST_TIMER_USER_DEFAULT',
      seconds,
    } as Action);
};

export const dispatchSetRestTimerExerciseDefault = () => {
  const dispatch = useDispatch();
  return (exerciseId: number, seconds: number) =>
    dispatch({
      type: 'SET_REST_TIMER_EXERCISE_DEFAULT',
      exerciseId,
      seconds,
    } as Action);
};

export const dispatchStartRestTimer = () => {
  const dispatch = useDispatch();
  return (params: {targetSeconds: number; exerciseId?: number; setIndex?: number; startedAt?: number}) =>
    dispatch({
      type: 'START_REST_TIMER',
      startedAt: params.startedAt ?? Date.now(),
      targetSeconds: params.targetSeconds,
      exerciseId: params.exerciseId,
      setIndex: params.setIndex,
    } as Action);
};

export const dispatchUpdateRestTimerTarget = () => {
  const dispatch = useDispatch();
  return (targetSeconds: number) =>
    dispatch({
      type: 'UPDATE_REST_TIMER_TARGET',
      targetSeconds,
    } as Action);
};

export const dispatchResetRestTimer = () => {
  const dispatch = useDispatch();
  return (startedAt?: number) =>
    dispatch({
      type: 'RESET_REST_TIMER',
      startedAt: startedAt ?? Date.now(),
    } as Action);
};

export const dispatchDismissRestTimer = () => {
  const dispatch = useDispatch();
  return () =>
    dispatch({
      type: 'DISMISS_REST_TIMER',
    } as Action);
};
