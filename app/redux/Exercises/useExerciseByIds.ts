import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useExerciseByIds = (exerciseIds: number[]) => useSelector((state: GlobalState) => exerciseIds.map(exerciseId => state.exercises.byId[exerciseId]));
