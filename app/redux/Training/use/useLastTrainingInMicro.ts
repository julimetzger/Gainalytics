import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {getAllTrainingsForTraining} from '../trainingsPlanReducer';

export const useLastTrainingInMicro = (trainingsPlanId: number, trainingsNumber: number) =>
  useSelector((state: GlobalState) => {
    const microsForTraining = getAllTrainingsForTraining(state.trainingsPlan.byId[trainingsPlanId].trainings, trainingsNumber);
    let trainingsId = microsForTraining[microsForTraining.length - 1];
    return trainingsId ? state.trainings.byId[trainingsId] : undefined;
  });
