import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useAllTrainingsPlans = () => useSelector((state: GlobalState) => state.trainingsPlan.allIds.map((value: number) => state.trainingsPlan.byId[value]));
