import {NormalizedState} from "../normalizedState";
import {AnyAction} from "@reduxjs/toolkit";


const initialState = {
    byId: {},
    allIds: []
} as NormalizedState<TrainingsPlan>


export function trainingInMicroIndex(micro: number, trainingInMicro: number) {
    return micro + "," + trainingInMicro;
}

export function getTrainingFromTrainingInMicroIndex(traiiningInMicroIndex: string) {
    return parseInt(traiiningInMicroIndex.split(",")[1]);
}

export function getMicorFromTrainingInMicroIndex(traiiningInMicroIndex: string) {
    return parseInt(traiiningInMicroIndex.split(",")[0]);
}

export function getMicrosForTraining(trainings: {
    [microComaTrainingInMicro: string]: number
}, trainingsNumber: number) {
    return Object.entries(trainings).filter(([key, value]) => key.endsWith("," + trainingsNumber))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => value);
}

export function getAllTrainingsForMicro(trainings: {
    [microComaTrainingInMicro: string]: number
}, micorNumber: number) {
    return Object.entries(trainings).filter(([key, value]) => key.startsWith(micorNumber.toString()))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => value);
}


function determineNewId(trainingsPlanState: NormalizedState<TrainingsPlan>) {
    if (trainingsPlanState.allIds.length > 0)
        return Math.max(...trainingsPlanState.allIds) + 1;
    else
        return 1;
}

const trainingsPlanReducer = (state: NormalizedState<TrainingsPlan> = initialState, action: AnyAction) => {
    const trainingsPlan = state.byId[action.trainingsPlanId];
    switch (action.type) {
        case 'ADD_TRAININGS_PLAN':
            const newId = determineNewId(state);
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [newId]: {...action.trainingsPlan, id: newId, trainings: {}}
                },
                allIds: [...state.allIds, newId]
            }
        case 'EDIT_TRAININGS_PLAN':
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [action.trainingsPlanId]: {...state.byId[action.trainingsPlanId], name: action.name}
                }
            }
        case 'DELETE_TRAININGS_PLAN':
            const byId = {...state.byId};
            delete byId[action.trainingsPlanId];
            return {
                ...state,
                byId,
                allIds: state.allIds.filter(id => id !== action.trainingsPlanId)
            }
        case 'ADD_PLANED_TRAINING_WORKOUT':
        case 'SUGGEST_TRAINING':
        case 'MODIFY_EXERCISES_IN_TRAINING':
            if (action.trainingsId === undefined) {
                state.byId[action.trainingsPlanId] = {
                    ...trainingsPlan,
                    trainings: {
                        ...trainingsPlan.trainings,
                        [trainingInMicroIndex(action.microNumber, action.trainingInMicroNumber)]: action.nextTrainingsId
                    }
                };
            }
            return {...state, byId: {...state.byId}};
        default:
            return state;
    }
}

export default trainingsPlanReducer;
