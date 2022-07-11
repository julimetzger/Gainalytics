import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';

const initialState = {
    byId: {},
    allIds: []
};

const exerciseReducer = (exercise: NormalizedState<Workout> = initialState, action: AnyAction) => {
    switch (action.type) {
        case 'ADD_WORKOUT': {
            let newId;
            if (exercise.allIds.length > 0)
                newId = Math.max(...exercise.allIds) + 1;
            else
                newId = 1;
            exercise.allIds.push(newId);
            // TODO use valid end and start dates
            exercise.byId[newId] = {...action.workout, id: newId, start: Date.now(), end: Date.now()};
            return {
                byId: exercise.byId,
                allIds: exercise.allIds
            } as NormalizedState<Workout>;
        }
        default:
            return exercise;
    }
};

export default exerciseReducer;
