import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export const useTrainings = () => useSelector((state: GlobalState) => state.trainings.allIds.map((value: number) => state.trainings.byId[value]));
