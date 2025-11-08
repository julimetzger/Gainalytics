import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export const useAlleExercises = () => useSelector((state: GlobalState) => state.exercises.allIds.map((value: number) => state.exercises.byId[value]));
