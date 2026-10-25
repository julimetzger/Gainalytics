import {createSelector} from '@reduxjs/toolkit';
import {useSelector} from 'react-redux';
import {BodyWeightEntry} from '../../../models/entities/BodyWeightEntry';
import {GlobalState} from '../../rootReducer';

const EMPTY_ENTRIES: BodyWeightEntry[] = [];

const selectById = (state: GlobalState) => state.bodyWeight?.byId;
const selectAllIds = (state: GlobalState) => state.bodyWeight?.allIds;

/** All entries, newest first. */
export const selectBodyWeightEntries = createSelector([selectById, selectAllIds], (byId, allIds): BodyWeightEntry[] => {
  if (!byId || !allIds || allIds.length === 0) {
    return EMPTY_ENTRIES;
  }
  return allIds.map((id) => byId[id]).sort((left, right) => right.date - left.date || right.id - left.id);
});

export const useBodyWeightEntries = () => useSelector(selectBodyWeightEntries);
