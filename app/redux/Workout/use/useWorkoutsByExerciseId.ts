import {shallowEqual, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/entities/Workout';

export const useWorkoutsByExerciseId = (exerciseId: number | undefined): Workout[] =>
  // The selector builds a fresh array literal on every call (empty `[]` for the
  // undefined/empty case, a fresh `.map(...)` otherwise). Without an equality
  // fn the default `===` check sees a new reference on every store dispatch and
  // forces every caller (e.g. the History FlashList screen) to re-render even
  // when the workouts did not change. `shallowEqual` compares array contents,
  // stabilizing both the empty case and the filtered list.
  useSelector((state: GlobalState) => {
    if (exerciseId === undefined) return [] as Workout[];
    const ids = state.workouts.byExerciseId?.[exerciseId];
    if (!ids || ids.length === 0) return [] as Workout[];
    return ids
      .map((id) => state.workouts.byId[id])
      .filter((w): w is Workout => w !== undefined);
  }, shallowEqual);
