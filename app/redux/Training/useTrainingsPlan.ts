import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useAllTrainingsPlans = (trainingsPlanId: number) => useSelector((state: GlobalState) => state.trainingsPlan.byId[trainingsPlanId]);
