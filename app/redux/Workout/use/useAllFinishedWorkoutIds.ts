import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {createSelector} from '@reduxjs/toolkit';
import {NormalizedWorkoutState} from '../../normalizedWorkoutState';
import {Workout} from '../../../models/entities/Workout';

const selectAllFinishedWorkoutIds = createSelector(
  (state: GlobalState) => state.workouts,
  (workouts: NormalizedWorkoutState<Workout>) =>
    [...workouts.allIds]
      .filter(id => workouts.byId[id]?.start !== undefined)
      .reverse(),
);

export const useAllFinishedWorkoutIds = () =>
  useSelector(selectAllFinishedWorkoutIds);
