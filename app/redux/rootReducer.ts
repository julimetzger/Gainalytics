import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';
import {NormalizedState} from './normalizedState';
import workoutReducer from "./Workout/workoutReducer";
import {NormalizedWorkoutState} from "./normalizedWorkoutState";
import trainingsPlanReducer from "./Training/trainingsPlanReducer";
import trainingsReducer from "./Training/trainingsReducer";
import settingsReducer, {AppSettings} from "./settings/settingsReducer";


export interface GlobalState {
    exercises: NormalizedState<Exercise>;
    workouts: NormalizedWorkoutState<Workout>,
    trainingsPlan: NormalizedState<TrainingsPlan>,
    trainings: NormalizedState<Training>,
    settings: AppSettings

}

export default combineReducers<GlobalState>({
    exercises: exerciseReducer,
    workouts: workoutReducer,
    trainingsPlan: trainingsPlanReducer,
    trainings: trainingsReducer,
    settings: settingsReducer
});
