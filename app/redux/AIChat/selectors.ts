import {createSelector} from '@reduxjs/toolkit';
import {GlobalState} from '../rootReducer';
import {Training} from '../../models/entities/Training';
import {TrainingsState} from '../../models/TrainingsState';

export const selectAllFinishedTrainings = createSelector(
  (state: GlobalState) => state.trainings.byId,
  (state: GlobalState) => state.trainings.allIds,
  (byId, allIds) =>
    (allIds as number[])
      .map(id => (byId as Record<number, Training>)[id])
      .filter((t): t is Training => t != null && t.state === TrainingsState.FINISHED),
);
