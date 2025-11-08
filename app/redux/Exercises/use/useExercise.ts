import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export const useExercise = (exerciseId?: number) => useSelector((state: GlobalState) => (exerciseId ? state.exercises.byId[exerciseId] : undefined));
