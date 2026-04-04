import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchEditTrainingTimes = () => {
  const dispatch = useDispatch();

  return (trainingsId: number, start: number, end: number) =>
    dispatch({
      type: 'EDIT_TRAINING_TIMES',
      trainingsId,
      start,
      end,
    } as Action);
};
