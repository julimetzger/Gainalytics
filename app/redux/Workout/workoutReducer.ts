import {AnyAction} from '@reduxjs/toolkit';
import {NormalizedState} from '../normalizedState';
import {NormalizedWorkoutSatete} from "../normalizedWorkoutState";

const initialState = {
    byId: {},
    allIds: [],
    byExerciseId: {}
};

const exerciseReducer = (workoutState: NormalizedWorkoutSatete<Workout> = initialState, action: AnyAction) => {
    switch (action.type) {
        case 'ADD_WORKOUT': {
            let newId;
            if (workoutState.allIds.length > 0)
                newId = Math.max(...workoutState.allIds) + 1;
            else
                newId = 1;
            workoutState.allIds.push(newId);
            // TODO use valid end and start dates
            workoutState.byId[newId] = {...action.workout, id: newId};
            if (workoutState.byExerciseId[action.workout.exerciseId] === undefined)
                workoutState.byExerciseId[action.workout.exerciseId] = [newId];
            else
                workoutState.byExerciseId[action.workout.exerciseId].push(newId)
            return {
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
