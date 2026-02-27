import {useDispatch} from 'react-redux';
import {Action} from 'redux';

interface DeleteTrainingActionParams {
  trainingsPlanId: number;
  trainingsId: number;
  micro: number;
  trainingInMicro: number;
  workoutIds: number[];
}

export const dispatchDeleteTraining = () => {
  const dispatch = useDispatch();

  return ({trainingsPlanId, trainingsId, micro, trainingInMicro, workoutIds}: DeleteTrainingActionParams) =>
    dispatch({
      type: 'DELETE_TRAINING',
      trainingsPlanId,
      trainingsId,
      micro,
      trainingInMicro,
      workoutIds,
    } as Action);
};
