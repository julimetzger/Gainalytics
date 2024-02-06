import {NormalizedState} from "../normalizedState";
import {AnyAction} from "@reduxjs/toolkit";


const initialState = {
    byId: {},
    allIds: []
} as NormalizedState<Training>


const trainingsReducer = (state: NormalizedState<Training> = initialState, action: AnyAction) => {
    switch (action.type) {
        case 'ADD_TRAINING':
            const newId = state.allIds.length + 1;
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [action.payload.id]: {...action.trainingsPlan, id: newId}
                },
                allIds: [...state.allIds, newId]
            }
        case 'ADD_PLANED_TRAINING_WORKOUT':
            let trainingsId = action.trainingsId;
            if (trainingsId === undefined) {
                trainingsId = action.nextTrainingsId;
                state.byId = {
                    ...state.byId,
                    [trainingsId]: {...action.trainingsPlan, id: trainingsId}
                }
                state.allIds.push(trainingsId);
            }
            if (action.workout.id === undefined) {
                state.byId[trainingsId].plannedWorkouts = {
                    ...state.byId[trainingsId].plannedWorkouts,
                    [action.exerciseId]: action.nextWorkoutId
                }
            }
            return {
                ...state,
                byId: {
                    ...state.byId,
                },
                ...state.allIds
            }
        default:
            return state;
    }
}
export default trainingsReducer;
