import {Action} from 'redux';
import {useDispatch} from 'react-redux';

/** GH-623: undo of FINISH_TRAINING. `previousLastTraining` is the plan's last training before the finish. */
export const dispatchReopenTraining = () => {
  const dispatch = useDispatch();

  return (trainingsId: number, trainingsPlanId: number, previousLastTraining: number | undefined) =>
    dispatch({
      type: 'REOPEN_TRAINING',
      trainingsId,
      trainingsPlanId,
      previousLastTraining,
    } as Action);
};
