import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {getAllTrainingsForMicro} from '../trainingsPlanReducer';
import {Training} from '../../../models/entities/Training';

export const selectAllTrainingsInMicro = (state: GlobalState, trainingsPlanId: number, micro: number): Training[] => {
  let trainingsIds = getAllTrainingsForMicro(state.trainingsPlan.byId[trainingsPlanId]?.trainings, micro);
  return trainingsIds.map((traingsId) => state.trainings.byId[traingsId]).filter((training) => training !== undefined) as Training[];
};

export const useAllTrainingsInMicro = (trainingsPlanId: number, micro: number): Training[] =>
  // shallowEqual: the mapped array is new on every dispatch — only a changed training object may re-render the caller
  useSelector((state: GlobalState) => selectAllTrainingsInMicro(state, trainingsPlanId, micro), shallowEqual);
