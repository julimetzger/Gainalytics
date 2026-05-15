import {useSelector} from 'react-redux';
import {createSelector} from '@reduxjs/toolkit';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/entities/Workout';

// Stable ref for the no-data branches (no exercise param / empty ids).
// History calls this hook unconditionally (Rules-of-Hooks) — without a
// module-level constant the inner selector would allocate a fresh `[]`
// every store tick and force unrelated re-renders on the unfiltered path.
const EMPTY_ARRAY: Workout[] = [];

const selectByExerciseId = (state: GlobalState) => state.workouts.byExerciseId;
const selectById = (state: GlobalState) => state.workouts.byId;
const selectExerciseIdArg = (_state: GlobalState, exerciseId: number | undefined) => exerciseId;

// createSelector recomputes when ANY input reference changes. The workout
// reducer clones `byId` for in-place mutations like FINALIZE_WORKOUT, so a
// new array reference is produced even when the contained workout objects
// are the same refs — which forces consumers to re-derive sorted/grouped
// state (e.g. History.tsx ordering by `end ?? start`). A previous attempt
// used `shallowEqual` on useSelector, but that silently bailed out in this
// scenario because the workout object refs themselves were unchanged.
const selectWorkoutsByExerciseId = createSelector(
  [selectByExerciseId, selectById, selectExerciseIdArg],
  (byExerciseId, byId, exerciseId) => {
    if (exerciseId === undefined) return EMPTY_ARRAY;
    const ids = byExerciseId?.[exerciseId];
    if (!ids || ids.length === 0) return EMPTY_ARRAY;
    return ids
      .map((id) => byId[id])
      .filter((w): w is Workout => w !== undefined);
  },
);

export const useWorkoutsByExerciseId = (exerciseId: number | undefined): Workout[] =>
  useSelector((state: GlobalState) => selectWorkoutsByExerciseId(state, exerciseId));
