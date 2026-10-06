import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Muscles} from '../../../models/Muscles';

// shallowEqual keeps the array reference stable while the matching exercises stay the same,
// so callers can use it as a memo dependency.
export const useExercisesForMuscles = (muscles: Muscles[]) =>
  useSelector(
    (state: GlobalState) => state.exercises.allIds.map((value: number) => state.exercises.byId[value]).filter((value) => value.muscles?.some((s) => muscles.includes(s.muscle!!))),
    shallowEqual,
  );
