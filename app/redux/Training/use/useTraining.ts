import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export const useTraining = (trainingsId?: number) => useSelector((state: GlobalState) => trainingsId ? state.trainings.byId[trainingsId] : undefined);
