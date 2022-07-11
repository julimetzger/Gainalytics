import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useExerciseById = (exerciseId: number) => useSelector((state: GlobalState) => state.exercises.byId[exerciseId]);
