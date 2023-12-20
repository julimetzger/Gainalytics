import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';
import {NormalizedWorkoutState} from "../normalizedWorkoutState";

const initialState = {
    byId: {},
    allIds: [],
    byExerciseId: {}
};

const exerciseReducer = (workoutState: NormalizedWorkoutState<Workout> = initialState, action: AnyAction) => {
    const byExerciseIdArray = workoutState.byExerciseId[action.workout.exerciseId];
    switch (action.type) {
        case 'ADD_WORKOUT': {
            let newId;
            if (workoutState.allIds.length > 0)
                newId = Math.max(...workoutState.allIds) + 1;
            else
                newId = 1;
            let idOfLaterWorkoutOrUndefined = workoutState.allIds.find(value => workoutState.byId[value].end!! > action.workout.end);
            if (idOfLaterWorkoutOrUndefined) {
                workoutState.allIds.splice(workoutState.allIds.indexOf(idOfLaterWorkoutOrUndefined), 0, newId);
            } else {
                workoutState.allIds.push(newId);
            }
            // TODO use valid end and start dates
            workoutState.byId[newId] = {...action.workout, id: newId};
            if (byExerciseIdArray === undefined)
                workoutState.byExerciseId[action.workout.exerciseId] = [newId];
            else {
                if (idOfLaterWorkoutOrUndefined) {
                    byExerciseIdArray.splice(byExerciseIdArray.indexOf(idOfLaterWorkoutOrUndefined), 0, newId);
                } else {
                    byExerciseIdArray.push(newId);
                }
            }
            return {
                byId: {...workoutState.byId},
                allIds: [...workoutState.allIds],
                byExerciseId: {...workoutState.byExerciseId}
            } as NormalizedState<Workout>;
        }
        case 'ADD_SET_TO_WORKOUT': {
            return workoutState;
        }
        case 'FINALIZE_WORKOUT': {
            return workoutState;
        }
        case 'DELETE_WORKOUT': {
            delete workoutState.byId[action.workout.id];
            workoutState.allIds = workoutState.allIds.filter(value => value !== action.workout.id);
            workoutState.byExerciseId[action.workout.exerciseId] = byExerciseIdArray.filter(value => value !== action.workout.id);
            return {
                ...workoutState,
                byId: {...workoutState.byId},
                allIds: [...workoutState.allIds],
                byExerciseId: {...workoutState.byExerciseId}
            } as NormalizedState<Workout>;
        }
        case 'UPDATE_WORKOUT': {
            workoutState.byId[action.workout.id] = {...action.workout}
            return {
                ...workoutState,
                byId: {...workoutState.byId},
            } as NormalizedState<Workout>;
        }
        default:
            return workoutState;
    }
};

export default exerciseReducer;
