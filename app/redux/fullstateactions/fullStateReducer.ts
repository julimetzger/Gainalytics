import {AnyAction} from '@reduxjs/toolkit';
import {GlobalState} from '../rootReducer';

const fullStateReducer = (state: GlobalState, action: AnyAction) => {
  switch (action.type) {
    case 'FULL_IMPORT':
      return action.state;
    default:
      return state;
  }
};

export default fullStateReducer;
