import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {VelocityLossReference} from '../../../models/entities/Exercise';

/** The active VL reference of an exercise, or undefined while it runs on the global curve. */
export const useExerciseVlReference = (exerciseId?: number): VelocityLossReference | undefined =>
  useSelector((state: GlobalState) => (exerciseId !== undefined ? state.exercises.byId[exerciseId]?.vlReference : undefined));
