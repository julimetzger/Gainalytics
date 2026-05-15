import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/entities/Workout';

// Stable ref for unfiltered History — see PR #280 review. Returning a fresh
// `[]` literal on each call would make the unconditional hook call in
// History.tsx propagate a new reference into useMemo deps on every store
// dispatch, even when no exercise param is set.
const EMPTY_ARRAY: Workout[] = [];

export const useWorkoutsByExerciseId = (exerciseId: number | undefined): Workout[] =>
  useSelector((state: GlobalState) => {
    if (exerciseId === undefined) return EMPTY_ARRAY;
    const ids = state.workouts.byExerciseId?.[exerciseId];
    if (!ids || ids.length === 0) return EMPTY_ARRAY;
    return ids
      .map((id) => state.workouts.byId[id])
      .filter((w): w is Workout => w !== undefined);
  }, shallowEqual);
