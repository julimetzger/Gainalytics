import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';
import {NormalizedWorkoutState} from "../normalizedWorkoutState";

const initialState = {
    byId: {},
    allIds: [],
    byExerciseId: {}
};

function addNewWorkoutToState(workoutState: NormalizedWorkoutState<Workout>, workout: Workout) {
    let newId;
    const byExerciseIdArray = workoutState.byExerciseId[workout.exerciseId];
    if (workoutState.allIds.length > 0)
        newId = Math.max(...workoutState.allIds) + 1;
    else
        newId = 1;
    let idOfLaterWorkoutOrUndefined = workoutState.allIds.find(value => workoutState.byId[value].end!! > workout.end!!);
    if (idOfLaterWorkoutOrUndefined) {
        workoutState.allIds.splice(workoutState.allIds.indexOf(idOfLaterWorkoutOrUndefined), 0, newId);
    } else {
        workoutState.allIds.push(newId);
    }
    // TODO use valid end and start dates
    workoutState.byId[newId] = {...workout, id: newId};
    if (byExerciseIdArray === undefined)
        workoutState.byExerciseId[workout.exerciseId] = [newId];
    else {
        if (idOfLaterWorkoutOrUndefined) {
            byExerciseIdArray.splice(byExerciseIdArray.indexOf(idOfLaterWorkoutOrUndefined), 0, newId);
        } else {
            byExerciseIdArray.push(newId);
        }
    }
    return newId;
}

const exerciseReducer = (workoutState: NormalizedWorkoutState<Workout> = initialState, action: AnyAction) => {
    switch (action.type) {
        case 'ADD_WORKOUT': {
            let newId = addNewWorkoutToState(workoutState, action.workout);
            if (workoutState.notFinishedWorkouts === undefined)
                workoutState.notFinishedWorkouts = {};
            workoutState.notFinishedWorkouts[action.workout.exerciseId] = newId;
            return {
                byId: {...workoutState.byId},
                allIds: [...workoutState.allIds],
                byExerciseId: {...workoutState.byExerciseId},
                notFinishedWorkouts: {...workoutState.notFinishedWorkouts}
            } as NormalizedState<Workout>;
        }

        case 'ADD_OR_UPDATE_SET_IN_WORKOUT': {
            if (action.set.index !== undefined) {
                let indexOf = workoutState.byId[action.workoutId].sets.map((value) => value.index).indexOf(action.set.index);
                workoutState.byId[action.workoutId].sets[indexOf] = action.set;
                let newState = {
                    ...workoutState,
                    byId: {...workoutState.byId},
                };
                newState.byId[action.workoutId].sets[indexOf] = {...action.set};
                return newState;
            }
            let sets = workoutState.byId[action.workoutId].sets;
            let LastIndex = sets.map(value => value.index).sort().pop();
            let newIndex = LastIndex ? LastIndex + 1 : 1;
            let arrayIndex = workoutState.byId[action.workoutId].sets.push({...action.set, index: newIndex}) - 1;
            let newState = {
                ...workoutState,
                byId: {...workoutState.byId},
            };
            newState.byId[action.workoutId].sets[arrayIndex] = {...workoutState.byId[action.workoutId].sets[arrayIndex]};
            return newState;
        }
        case 'FINALIZE_WORKOUT': {
            workoutState.byId[action.workoutId].end = action.end;
            if (workoutState.notFinishedWorkouts !== undefined)
                delete workoutState.notFinishedWorkouts[action.workoutId];
            return {
                ...workoutState,
                byId: {...workoutState.byId},
                notFinishedWorkouts: {...workoutState.notFinishedWorkouts}
            };
        }
        case 'DELETE_WORKOUT': {
            delete workoutState.byId[action.workout.id];
            workoutState.allIds = workoutState.allIds.filter(value => value !== action.workout.id);
            workoutState.byExerciseId[action.workout.exerciseId] = workoutState.byExerciseId[action.workout.exerciseId].filter(value => value !== action.workout.id);
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
