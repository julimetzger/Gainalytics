import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useExercise = (exerciseId: number) => useSelector((state: GlobalState) => state.exercises.byId[exerciseId]);
