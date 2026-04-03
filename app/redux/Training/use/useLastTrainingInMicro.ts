import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {getPreviousTrainingsForTrainingInMeso} from '../trainingsPlanReducer';

export const useLastTrainingInMicro = (trainingsPlanId: number, trainingsNumber: number, micro: number) =>
  useSelector((state: GlobalState) => {
    const trainingsPlan = state.trainingsPlan.byId[trainingsPlanId];
    if (!trainingsPlan) return undefined;
    const microsForTraining = getPreviousTrainingsForTrainingInMeso(trainingsPlan.trainings, trainingsNumber, micro, trainingsPlan.mesos);
    let trainingsId = microsForTraining[microsForTraining.length - 1];
    return trainingsId ? state.trainings.byId[trainingsId] : undefined;
  });
