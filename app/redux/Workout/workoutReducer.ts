import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';
import {determineNewWorkoutId, NormalizedWorkoutState} from "../normalizedWorkoutState";

const initialState = {
    byId: {},
    allIds: [],
    byExerciseId: {},
    plannedWorkouts: []
};

function addNewWorkoutToState(workoutState: NormalizedWorkoutState<Workout>, workout: Workout) {
    let newId = determineNewWorkoutId(workoutState);
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

function addNewPlannedWorkout(workoutState: NormalizedWorkoutState<Workout>, workout: Workout, newId: number) {
    workoutState.byId[newId] = {...workout, id: newId};
    if (workoutState.plannedWorkouts === undefined)
        workoutState.plannedWorkouts = [];
    workoutState.plannedWorkouts.push(newId);
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


function deleteWorkout(workoutState: NormalizedWorkoutState<Workout>, exerciseId: number, workoutId?: number) {
    if (workoutId === undefined) {
        let suggested = {...workoutState.suggestedWorkouts};
        delete suggested[exerciseId];
        return {
            ...workoutState,
            suggestedWorkouts: suggested
        } as NormalizedState<Workout>;
    }
    let {[workoutId]: removed, ...rest} = workoutState.byId;
    let notFinished = {...workoutState.notFinishedWorkouts};
    if (workoutState.notFinishedWorkouts !== undefined && workoutState.notFinishedWorkouts[exerciseId] !== undefined && workoutState.notFinishedWorkouts[exerciseId] === workoutId) {
        let {[exerciseId]: removedUnfinisehd, ...restUnfinished} = workoutState.notFinishedWorkouts;
        notFinished = {...restUnfinished};
    }
    return {
        ...workoutState,
        byId: {...rest},
        allIds: workoutState.allIds.filter(value => value !== workoutId),
        byExerciseId: {
            ...workoutState.byExerciseId,
            [exerciseId]: workoutState.byExerciseId[exerciseId]?.filter(value => value !== workoutId)
        },
        notFinishedWorkouts: notFinished
    } as NormalizedState<Workout>;
}

function handleDeleteSuggestedSetWhenNotFoundInPersistedSet(workoutState: NormalizedWorkoutState<Workout>, exerciseId: number, set: WorkoutSet) {
    let sets = [...workoutState.suggestedWorkouts[exerciseId].sets];
    sets.splice(workoutState.suggestedWorkouts[exerciseId].sets.map((value) => value.index).indexOf(set.index), 1);
    let suggested = {
        ...workoutState.suggestedWorkouts,
        [exerciseId]: {...workoutState.suggestedWorkouts[exerciseId], sets: sets}
    };
    if (sets.length === 0) {
        delete suggested[exerciseId];
    }
    return {...workoutState, suggestedWorkouts: suggested};
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
                    ...workoutState,
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
                    let newSets = workoutState.byId[action.workoutId].sets;
                    if (indexOf === -1) {
                        newSets.push(action.set);
                        migrateSuggestedToNotFinishedWorkout(workoutState, workoutState.byId[action.workoutId].exerciseId);
                        newSets = workoutState.byId[action.workoutId].sets.sort((a, b) => a.index!! - b.index!!);
                        return {
                            ...workoutState,
                            byId: {...workoutState.byId},
                            suggestedWorkouts: {...workoutState.suggestedWorkouts}
                        };
                    }
                    newSets[indexOf] = action.set;
                    return {
                        ...workoutState,
                        byId: {
                            ...workoutState.byId,
                            [action.workoutId]: {
                                ...workoutState.byId[action.workoutId], sets: newSets
                            }
                        },
                    };
                }
                let sets = [...workoutState.byId[action.workoutId].sets];
                let LastIndex = sets.map(value => value.index).sort().pop();
                let newIndex = LastIndex ? LastIndex + 1 : 1;
                let arrayIndex = workoutState.byId[action.workoutId].sets.push({...action.set, index: newIndex}) - 1;
                sets[arrayIndex] = {...workoutState.byId[action.workoutId].sets[arrayIndex]};
                return {
                    ...workoutState,
                    byId: {
                        ...workoutState.byId,
                        [action.workoutId]: {...workoutState.byId[action.workoutId], sets: sets}
                    },
                };
            }
            case 'DELETE_SET_FROM_WORKOUT': {
                if (action.workoutId === undefined && action.exerciseId !== undefined) {
                    return handleDeleteSuggestedSetWhenNotFoundInPersistedSet(workoutState, action.exerciseId, action.set);
                }
                let indexOf = workoutState.byId[action.workoutId].sets.map((value) => value.index).indexOf(action.set.index);
                if (indexOf === -1 && workoutState.suggestedWorkouts !== undefined && workoutState.suggestedWorkouts[action.exerciseId] !== undefined) {
                    return handleDeleteSuggestedSetWhenNotFoundInPersistedSet(workoutState, action.exerciseId, action.set);
                }
                let sets = [...workoutState.byId[action.workoutId].sets];
                sets.splice(indexOf, 1);
                if (sets.length === 0)
                    return deleteWorkout(workoutState, workoutState.byId[action.workoutId].exerciseId, action.workoutId);
                return {
                    ...workoutState,
                    byId: {
                        ...workoutState.byId,
                        [action.workoutId]: {...workoutState.byId[action.workoutId], sets: sets}
                    },
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
            'DELETE_WORKOUT': {
                return deleteWorkout(workoutState, action.workout.exerciseId, action.workout.id);
            }
            case
            'UPDATE_WORKOUT': {
                workoutState.byId[action.workout.id] = {...action.workout}
                return {
                    ...workoutState,
                    byId: {...workoutState.byId},
                } as NormalizedState<Workout>;
            }
            case
            'SUGGEST_WORKOUT': {
                const keys = workoutState.byExerciseId[action.exerciseId][workoutState.byExerciseId[action.exerciseId].length - 1];
                let lastWorkout = {
                    ...workoutState.byId[keys],
                    sets: [...workoutState.byId[keys].sets]
                } as Workout;
                if (workoutState.suggestedWorkouts === undefined)
                    workoutState.suggestedWorkouts = {};
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
            case 'DELETE_EXERCISE': {
                let allWorkoutsForExercise = workoutState.byExerciseId[action.exerciseId];
                if (allWorkoutsForExercise !== undefined) {
                    workoutState.allIds = workoutState.allIds.filter(value => !allWorkoutsForExercise.includes(value));
                    for (let id of allWorkoutsForExercise) {
                        delete workoutState.byId[id];
                    }
                }
                delete workoutState.byExerciseId[action.exerciseId];
                if (workoutState.suggestedWorkouts !== undefined && workoutState.suggestedWorkouts[action.exerciseId] !== undefined)
                    delete workoutState.suggestedWorkouts[action.exerciseId];
                if (workoutState.notFinishedWorkouts !== undefined && workoutState.notFinishedWorkouts[action.exerciseId] !== undefined)
                    delete workoutState.notFinishedWorkouts[action.exerciseId];
                return {
                    ...workoutState,
                } as NormalizedState<Workout>;
            }
            case 'ADD_PLANED_TRAINING_WORKOUT': {
                if (action.workout.id === undefined) {
                    addNewPlannedWorkout(workoutState, action.workout, action.nextWorkoutId);
                }
                return {
                    ...workoutState,
                    byId: {...workoutState.byId},
                    plannedWorkouts: [...workoutState.plannedWorkouts]
                }
            }
            case 'START_TRAINING': {
                let suggested = {...workoutState.suggestedWorkouts};
                action.workoutIds.forEach((value: number) => {

                    let plannedWorkout = {
                        ...workoutState.byId[value],
                    } as Workout;
                    plannedWorkout.id = undefined;
                    plannedWorkout.start = undefined;
                    plannedWorkout.end = undefined;
                    plannedWorkout.sets = plannedWorkout.sets.map(value => {
                        return {
                            ...value,
                            date: undefined
                        }
                    });
                    suggested = {
                        ...suggested,
                        [plannedWorkout.exerciseId]: plannedWorkout
                    };
                });
                return {...workoutState, suggestedWorkouts: {...suggested}};
            }
            default:
                return workoutState;
        }
    }
;

export default exerciseReducer;
