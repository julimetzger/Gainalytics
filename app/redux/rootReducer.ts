import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';
import {NormalizedState} from './normalizedState';
import workoutReducer from "./Workout/workoutReducer";
import {NormalizedWorkoutState} from "./normalizedWorkoutState";

export interface GlobalState {
    exercises: NormalizedState<Exercise>;
    workouts: NormalizedWorkoutState<Workout>
}

export default combineReducers<GlobalState>({
    exercises: exerciseReducer,
    workouts: workoutReducer
});
