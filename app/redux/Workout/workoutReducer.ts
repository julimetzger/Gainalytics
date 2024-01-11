import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';
import {NormalizedWorkoutState} from "../normalizedWorkoutState";

const initialState = {
    byId: {},
    allIds: [],
    byExerciseId: {}
};

function determineNewId(workoutState: NormalizedWorkoutState<Workout>) {
    if (workoutState.allIds.length > 0)
        return Math.max(...workoutState.allIds) + 1;
    else
        return 1;
}

function addNewWorkoutToState(workoutState: NormalizedWorkoutState<Workout>, workout: Workout) {
    let newId = determineNewId(workoutState);
    const byExerciseIdArray = workoutState.byExerciseId[workout.exerciseId];
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

function migrateSuggestedToNotFinishedWorkout(workoutState: NormalizedWorkoutState<Workout>, exerciseId: number) {
    if (workoutState.suggestedWorkouts !== undefined && workoutState.suggestedWorkouts[exerciseId] !== undefined) {
        let unfinshedWorkoutSets = workoutState.byId[workoutState.notFinishedWorkouts[exerciseId]].sets;
        let suggestedWorkoutSets = workoutState.suggestedWorkouts[exerciseId].sets;
        let persistedIndexes = unfinshedWorkoutSets.map(value => value.index);
        suggestedWorkoutSets = suggestedWorkoutSets.filter(value => !persistedIndexes.includes(value.index));
        workoutState.suggestedWorkouts[exerciseId].sets = suggestedWorkoutSets;
        if (suggestedWorkoutSets.length === 0)
            delete workoutState.suggestedWorkouts[exerciseId];
    }
}

function deleteWorkout(workoutState: NormalizedWorkoutState<Workout>, workoutId: number, exerciseId: number) {
    delete workoutState.byId[workoutId];
    workoutState.allIds = workoutState.allIds.filter(value => value !== workoutId);
    workoutState.byExerciseId[exerciseId] = workoutState.byExerciseId[exerciseId].filter(value => value !== workoutId);
    if (workoutState.notFinishedWorkouts !== undefined && workoutState.notFinishedWorkouts[exerciseId] !== undefined && workoutState.notFinishedWorkouts[exerciseId] === workoutId)
        delete workoutState.notFinishedWorkouts[exerciseId];
}

function handleDeleteSuggestedSetWithoutPersistedSet(workoutState: NormalizedWorkoutState<Workout>, exerciseId: number, workoutSet: WorkoutSet) {
    workoutState.suggestedWorkouts[exerciseId].sets.splice(workoutState.suggestedWorkouts[exerciseId].sets.map((value) => value.index).indexOf(workoutSet.index), 1);
    if (workoutState.suggestedWorkouts[exerciseId].sets.length === 0)
        delete workoutState.suggestedWorkouts[exerciseId];
    return {...workoutState, suggestedWorkouts: {...workoutState.suggestedWorkouts}};
}

function handleDeleteSuggestedSetWhenNotFoundInPersistedSet(workoutState: NormalizedWorkoutState<Workout>, exerciseId: number, set : WorkoutSet) {
    workoutState.suggestedWorkouts[exerciseId].sets.splice(workoutState.suggestedWorkouts[exerciseId].sets.map((value) => value.index).indexOf(set.index), 1);
    if (workoutState.suggestedWorkouts[exerciseId].sets.length === 0)
        delete workoutState.suggestedWorkouts[exerciseId];
    return {...workoutState, suggestedWorkouts: {...workoutState.suggestedWorkouts}};
}

const exerciseReducer = (workoutState: NormalizedWorkoutState<Workout> = initialState, action: AnyAction) => {
        switch (action.type) {
            case 'ADD_WORKOUT': {
                let newId = addNewWorkoutToState(workoutState, action.workout);
                if (workoutState.notFinishedWorkouts === undefined)
                    workoutState.notFinishedWorkouts = {};
                workoutState.notFinishedWorkouts[action.workout.exerciseId] = newId;
                migrateSuggestedToNotFinishedWorkout(workoutState, action.workout.exerciseId);
                return {
                    byId: {...workoutState.byId},
                    allIds: [...workoutState.allIds],
                    byExerciseId: {...workoutState.byExerciseId},
                    notFinishedWorkouts: {...workoutState.notFinishedWorkouts},
                    suggestedWorkouts: {...workoutState.suggestedWorkouts}
                } as NormalizedState<Workout>;
            }

            case 'ADD_OR_UPDATE_SET_IN_WORKOUT': {
                if (action.set.index !== undefined) {
                    let indexOf = workoutState.byId[action.workoutId].sets.map((value) => value.index).indexOf(action.set.index);
                    if (indexOf === -1) {
                        workoutState.byId[action.workoutId].sets.push(action.set);
                        migrateSuggestedToNotFinishedWorkout(workoutState, workoutState.byId[action.workoutId].exerciseId);
                        workoutState.byId[action.workoutId].sets = workoutState.byId[action.workoutId].sets.sort((a, b) => a.index!! - b.index!!);
                        return {
                            ...workoutState,
                            byId: {...workoutState.byId},
                            suggestedWorkouts: {...workoutState.suggestedWorkouts}
                        };
                    }
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
            case 'DELETE_SET_FROM_WORKOUT': {
                if (action.workoutId === undefined && action.exerciseId !== undefined) {
                    return handleDeleteSuggestedSetWithoutPersistedSet(workoutState, action.exerciseId,action.set);
                }
                let indexOf = workoutState.byId[action.workoutId].sets.map((value) => value.index).indexOf(action.set.index);
                if (indexOf === -1 && workoutState.suggestedWorkouts !== undefined && workoutState.suggestedWorkouts[action.exerciseId] !== undefined) {
                    return handleDeleteSuggestedSetWhenNotFoundInPersistedSet(workoutState, action.exerciseId, action.set);
                }
                workoutState.byId[action.workoutId].sets.splice(indexOf, 1);
                if (workoutState.byId[action.workoutId].sets.length === 0)
                    deleteWorkout(workoutState, action.workoutId, workoutState.byId[action.workoutId].exerciseId);
                return {
                    ...workoutState,
                    byId: {...workoutState.byId},
                    allIds: [...workoutState.allIds],
                    byExerciseId: {...workoutState.byExerciseId}
                };
            }
            case 'FINALIZE_WORKOUT': {
                workoutState.byId[action.workoutId].end = action.end;
                if (workoutState.notFinishedWorkouts !== undefined)
                    for (let key in workoutState.notFinishedWorkouts) {
                        if (workoutState.notFinishedWorkouts[key] === action.workoutId)
                            delete workoutState.notFinishedWorkouts[key];
                    }
                if (workoutState.suggestedWorkouts !== undefined && workoutState.suggestedWorkouts[workoutState.byId[action.workoutId].exerciseId] !== undefined)
                    delete workoutState.suggestedWorkouts[workoutState.byId[action.workoutId].exerciseId];
                return {
                    ...workoutState,
                    byId: {...workoutState.byId},
                    notFinishedWorkouts: {...workoutState.notFinishedWorkouts},
                    suggestedWorkouts: {...workoutState.suggestedWorkouts}
                };
            }
            case
            'DELETE_WORKOUT'
            : {
                deleteWorkout(workoutState, action.workout.id, action.workout.exerciseId);
                return {
                    ...workoutState,
                    byId: {...workoutState.byId},
                    allIds: [...workoutState.allIds],
                    byExerciseId: {...workoutState.byExerciseId}
                } as NormalizedState<Workout>;
            }
            case
            'UPDATE_WORKOUT'
            : {
                workoutState.byId[action.workout.id] = {...action.workout}
                return {
                    ...workoutState,
                    byId: {...workoutState.byId},
                } as NormalizedState<Workout>;
            }
            case
            'SUGGEST_WORKOUT'
            : {
                const keys = workoutState.byExerciseId[action.exerciseId][workoutState.byExerciseId[action.exerciseId].length - 1];
                console.log(keys);
                let lastWorkout = {
                    ...workoutState.byId[keys],
                    sets: [...workoutState.byId[keys].sets]
                } as Workout;
                if (workoutState.suggestedWorkouts === undefined)
                    workoutState.suggestedWorkouts = {};
                console.log(lastWorkout);
                lastWorkout.id = undefined;
                lastWorkout.start = undefined;
                lastWorkout.end = undefined;
                lastWorkout.sets = lastWorkout.sets.map(value => {
                    return {
                        ...value,
                        date: undefined
                    }
                });
                workoutState.suggestedWorkouts[action.exerciseId] = lastWorkout;
                return {
                    ...workoutState,
                    suggestedWorkouts: {...workoutState.suggestedWorkouts}
                };
            }
            default:
                return workoutState;
        }
    }
;

export default exerciseReducer;
