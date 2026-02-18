import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {getAllTrainingsForMicro} from '../trainingsPlanReducer';
import {Training} from '../../../models/entities/Training';

export const useAllTrainingsInMicro = (trainingsPlanId: number, micro: number): Training[] =>
  useSelector((state: GlobalState) => {
    let trainingsIds = getAllTrainingsForMicro(state.trainingsPlan.byId[trainingsPlanId]?.trainings, micro);
    return trainingsIds.map((traingsId) => state.trainings.byId[traingsId]).filter((training) => training !== undefined) as Training[];
  });
