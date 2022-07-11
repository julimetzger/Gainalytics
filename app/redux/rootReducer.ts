import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';
import {NormalizedState} from './normalizedState';
import workoutReducer from "./Workout/workoutReducer";

export interface GlobalState {
    exercises: NormalizedState<Exercise>;
    workouts: NormalizedState<Workout>
}

export default combineReducers<GlobalState>({
    exercises: exerciseReducer,
    workouts: workoutReducer
});
