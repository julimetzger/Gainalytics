import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';
import {NormalizedState} from './normalizedState';
import workoutReducer from "./Workout/workoutReducer";
import {NormalizedWorkoutSatete} from "./normalizedWorkoutState";

export interface GlobalState {
    exercises: NormalizedState<Exercise>;
    workouts: NormalizedWorkoutSatete<Workout>
}

export default combineReducers<GlobalState>({
    exercises: exerciseReducer,
    workouts: workoutReducer
});
