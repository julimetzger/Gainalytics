import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {determineNewId} from '../../normalizedState';

export const useNextTrainingsId = () => useSelector((state: GlobalState) => determineNewId(state.trainings));
