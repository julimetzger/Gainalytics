import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useAlleExercises = () => useSelector((state: GlobalState) => state.exercises.exercises);
