import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useTrainingsPlan = (trainingsPlanId: number) => useSelector((state: GlobalState) => state.trainingsPlan.byId[trainingsPlanId]);
