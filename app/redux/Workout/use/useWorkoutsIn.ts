import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Range} from '../../../components/picker/date/DateRangePicker';
import {createSelector, lruMemoize} from '@reduxjs/toolkit';
import {NormalizedState} from '../../normalizedState';
import {Workout} from '../../../models/entities/Workout';

const selectWorkouts = (state: GlobalState) => state.workouts;

const findWorkoutsInBounds = (allIds: NormalizedState<Workout>, startMs: number, endMs: number) => {
  let allWorkouts: Workout[] = allIds.allIds.map((value: number) => allIds.byId[value]);
  return allWorkouts.filter(
    (workout: Workout) => workout.start !== undefined && new Date(workout.start).getTime() >= startMs && new Date(workout.end ?? workout.start).getTime() <= endMs,
  );
};

export function findWorkoutsIn(allIds: NormalizedState<Workout>, range: Range) {
  return findWorkoutsInBounds(allIds, new Date(range.startDate).getTime(), new Date(range.endDate).getTime());
}

// GH-675: one selector per hook instance, keyed on the range's VALUES. Callers build a new Range on every
// render (Dashboard: this week; Metrics: three panes, each with its comparison period and a banner), so a
// shared selector keyed on the Range object scanned every workout again for every call on every render.
const makeWorkoutsInSelector = () =>
  createSelector(
    [selectWorkouts, (_state: GlobalState, startMs: number) => startMs, (_state: GlobalState, _startMs: number, endMs: number) => endMs],
    findWorkoutsInBounds,
    {memoize: lruMemoize, argsMemoize: lruMemoize},
  );

export const useWorkoutsIn = (range: Range) => {
  const selector = useMemo(makeWorkoutsInSelector, []);
  const startMs = new Date(range.startDate).getTime();
  const endMs = new Date(range.endDate).getTime();
  return useSelector(
    (state: GlobalState) => selector(state, startMs, endMs),
    (left, right) => left.length === right.length,
  );
};
