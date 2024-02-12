import {NormalizedState} from "../normalizedState";
import {AnyAction} from "@reduxjs/toolkit";
import {TrainingsState} from "../../models/TrainingsState";


const initialState = {
    byId: {},
    allIds: []
} as NormalizedState<Training>


const trainingsReducer = (state: NormalizedState<Training> = initialState, action: AnyAction) => {
    function createTrainingIfNotPresent(trainingsId: number, training: Training, allIds: number[]) {
        if (trainingsId === undefined) {
            trainingsId = action.nextTrainingsId;
            training = {
                ...action.trainingsPlan,
                id: trainingsId,
                started: false,
                finished: false,
                doneWorkoutIds: {},
                plannedWorkouts: {},
                exercises: [action.exerciseId],
                state: TrainingsState.PLANNED
            }
            allIds.push(trainingsId);
        }
        return {trainingsId, training};
    }

    function addWorkout(training: Training) {
        if (action.workout.id === undefined) {
            training.plannedWorkouts = {
                ...training.plannedWorkouts,
                [action.exerciseId]: action.nextWorkoutId
            }
        }
    }

    let trainingsId = action.trainingsId;
    let training = {...state.byId[trainingsId]};
    let allIds = [...state.allIds];
    switch (action.type) {
        case 'ADD_PLANED_TRAINING_WORKOUT':
            const __ret = createTrainingIfNotPresent(trainingsId, training, allIds);
            trainingsId = __ret.trainingsId;
            training = __ret.training;
            addWorkout(training);
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [trainingsId]: training
                },
                allIds: [...allIds]
            }
        case 'MODIFY_EXERCISES_IN_TRAINING':
            const ret = createTrainingIfNotPresent(trainingsId, training, allIds);
            trainingsId = ret.trainingsId;
            training = ret.training;
            training.exercises = action.exercises.map((exercise: { id: Exercise; }) => exercise.id);
            for (let key in training.plannedWorkouts) {
                if (!training.exercises.includes(Number(key))) {
                    delete training.plannedWorkouts[key];
                }
            }
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [trainingsId]: training
                },
                allIds: [...allIds]
            }
        case 'ADD_WORKOUT':
            if (action.trainingsId === undefined)
                return state;
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [action.trainingsId]: {
                        ...state.byId[action.trainingsId],
                        doneWorkoutIds: {
                            ...state.byId[action.trainingsId].doneWorkoutIds,
                            [action.workout.exerciseId]: action.nextWorkoutId
                        }
                    }
                }
            }
        case 'FINISH_TRAINING':
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [action.trainingsId]: {
                        ...state.byId[action.trainingsId],
                        state: TrainingsState.FINISHED,
                        end: action.date
                    }
                }
            }
        case 'START_TRAINING':
            if (state.byId[action.trainingsId].state === TrainingsState.STARTED)
                return state;
            return {
                ...state,
                byId: {
                    ...state.byId,
                    [action.trainingsId]: {
                        ...state.byId[action.trainingsId],
                        state: TrainingsState.STARTED,
                        start: action.date,
                    }
                }
            }
        case 'DELETE_SET_FROM_WORKOUT':
            return state;
        default:
            return state;
    }
}
export default trainingsReducer;
