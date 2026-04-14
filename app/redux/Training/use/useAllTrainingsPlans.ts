import {useSelector} from 'react-redux';
import {createSelector} from '@reduxjs/toolkit';
import {GlobalState} from '../../rootReducer';

// Memoized selector: only creates a new array when allIds or byId reference changes.
// Without this, the inline .map() inside useSelector returned a new array reference on
// every store tick, causing TrainingElementPicker to re-render endlessly (GH-127).
const selectAllTrainingsPlans = createSelector(
  (state: GlobalState) => state.trainingsPlan.allIds,
  (state: GlobalState) => state.trainingsPlan.byId,
  (allIds, byId) => allIds.map((id) => byId[id]),
);

export const useAllTrainingsPlans = () => useSelector(selectAllTrainingsPlans);
