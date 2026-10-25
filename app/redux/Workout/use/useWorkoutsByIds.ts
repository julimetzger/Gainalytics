import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

// shallowEqual: the mapped array is new on every store tick; comparing its elements
// keeps the result (and every memo keyed on it) stable while the workouts are unchanged.
export const useWorkoutsByIds = (ids: number[]) => useSelector((state: GlobalState) => ids.map((id) => state.workouts.byId[id]).filter((workout) => workout !== undefined), shallowEqual);
