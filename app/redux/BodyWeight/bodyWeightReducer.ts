import {AnyAction} from '@reduxjs/toolkit';
import {BodyWeightEntry} from '../../models/entities/BodyWeightEntry';
import {NormalizedState, determineNewId} from '../normalizedState';

export const initialBodyWeightState: NormalizedState<BodyWeightEntry> = {
  byId: {},
  allIds: [],
};

const bodyWeightReducer = (state: NormalizedState<BodyWeightEntry> = initialBodyWeightState, action: AnyAction): NormalizedState<BodyWeightEntry> => {
  switch (action.type) {
    case 'ADD_BODY_WEIGHT_ENTRY': {
      const id = determineNewId(state);
      const entry: BodyWeightEntry = {...action.entry, id};
      return {byId: {...state.byId, [id]: entry}, allIds: [...state.allIds, id]};
    }
    case 'EDIT_BODY_WEIGHT_ENTRY': {
      const current = state.byId[action.entry.id];
      if (!current) {
        return state;
      }
      // Rebuilt from the edited entry so a removed note does not linger.
      const edited: BodyWeightEntry = {...action.entry, id: current.id};
      return {...state, byId: {...state.byId, [current.id]: edited}};
    }
    case 'DELETE_BODY_WEIGHT_ENTRY': {
      if (!state.byId[action.entryId]) {
        return state;
      }
      const {[action.entryId]: _removed, ...byId} = state.byId;
      return {byId, allIds: state.allIds.filter((id) => id !== action.entryId)};
    }
    default:
      return state;
  }
};

export default bodyWeightReducer;
