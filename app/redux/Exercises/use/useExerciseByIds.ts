import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Exercise} from '../../../models/entities/Exercise';

// GH-486: an id whose exercise was deleted is skipped instead of yielding `undefined`,
// which every caller dereferences (`exercise.id`, `exercise.name`).
export const useExerciseByIds = (exerciseIds: number[]) =>
  useSelector(
    (state: GlobalState) => exerciseIds.map((exerciseId) => state.exercises.byId[exerciseId]).filter((exercise): exercise is Exercise => exercise !== undefined),
    shallowEqual,
  );
