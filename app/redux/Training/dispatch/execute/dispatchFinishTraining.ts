import {Action} from 'redux';
import {useDispatch} from 'react-redux';

export const dispatchFinishTraining = () => {
  const dispatch = useDispatch();

  return (trainingsId: number, trainingsPlanId: number) =>
    dispatch({
      type: 'FINISH_TRAINING',
      trainingsId,
      trainingsPlanId,
      date: new Date().getTime(),
    } as Action);
};
