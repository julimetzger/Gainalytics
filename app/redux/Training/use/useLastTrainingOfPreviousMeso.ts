import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {getLastTrainingOfPreviousMeso} from '../trainingsPlanReducer';

export const useLastTrainingOfPreviousMeso = (trainingsPlanId: number, trainingsNumber: number, currentMicro: number) =>
  useSelector((state: GlobalState) => {
    const trainingsPlan = state.trainingsPlan.byId[trainingsPlanId];
    if (!trainingsPlan) return undefined;
    const trainingsId = getLastTrainingOfPreviousMeso(trainingsPlan.trainings, trainingsNumber, currentMicro, trainingsPlan.mesos);
    return trainingsId ? state.trainings.byId[trainingsId] : undefined;
  });
