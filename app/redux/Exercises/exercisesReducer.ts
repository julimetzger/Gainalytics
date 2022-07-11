import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';

const initialState = {
    byId: {
        1: {id: 1, name: 'Bankdrücken'},
        2: {id: 2, name: 'Squat'},
        3: {id: 3, name: 'Deadlift'},
    },
    allIds: [1, 2, 3]
} as NormalizedState<Exercise>

const exerciseReducer = (exercises: NormalizedState<Exercise> = initialState, action: AnyAction) => {
        switch (action.type) {
            case 'ADD_EXERCISE': {
                const newId = Math.max(...exercises.allIds) + 1;
                exercises.allIds.push(newId);
                exercises.byId[newId] = {id: newId, name: action.nameOfExercise} as Exercise;
                return {
                    byId: {
                        ...exercises.byId,
                    },
                    allIds: exercises.allIds,
                };
            }
            default:
                return exercises;
        }
    }
;

export default exerciseReducer;
