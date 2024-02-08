import {NormalizedState} from "../normalizedState";
import {AnyAction} from "@reduxjs/toolkit";


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
            console.log(state);
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
        default:
            return state;
    }
}
export default trainingsReducer;
