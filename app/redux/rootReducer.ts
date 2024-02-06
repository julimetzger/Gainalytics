import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';
import {NormalizedState} from './normalizedState';
import workoutReducer from "./Workout/workoutReducer";
import {NormalizedWorkoutState} from "./normalizedWorkoutState";
import trainingsPlanReducer from "./Training/trainingsPlanReducer";
import trainingsReducer from "./Training/trainingsReducer";

export interface GlobalState {
    exercises: NormalizedState<Exercise>;
    workouts: NormalizedWorkoutState<Workout>,
    trainingsPlan: NormalizedState<TrainingsPlan>,
    trainings: NormalizedState<Training>,

}

export default combineReducers<GlobalState>({
    exercises: exerciseReducer,
    workouts: workoutReducer,
    trainingsPlan: trainingsPlanReducer,
    trainings: trainingsReducer
});
