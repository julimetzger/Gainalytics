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
                return {
                    byId: {
                        ...exercises.byId,
                        [newId]: {id: newId, name: action.nameOfExercise, muscles: action.muscles} as Exercise
                    },
                    allIds: [...exercises.allIds, newId],
                };
            }
            case 'DELETE_EXERCISE': {
                const index = exercises.allIds.indexOf(action.exerciseId);
                exercises.allIds.splice(index, 1);
                delete exercises.byId[action.exerciseId];
                return {
                    byId: {
                        ...exercises.byId,
                    },
                    allIds: [...exercises.allIds],
                };
            }
            case 'EDIT_EXERCISE': {
                return {
                    byId: {
                        ...exercises.byId,
                        [action.exerciseId]: {
                            ...exercises.byId[action.exerciseId],
                            name: action.nameOfExercise,
                            muscles: action.muscles,
                        },
                    },
                    allIds: [...exercises.allIds],
                };
            }
            default:
                return exercises;
        }
    }
;

export default exerciseReducer;
