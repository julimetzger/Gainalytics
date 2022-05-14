import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';

export interface ExerciseState {
  exercises: Exercise[];
}

export interface GlobalState {
  exercises: ExerciseState;
}

export default combineReducers<GlobalState>({
  exercises: exerciseReducer,
});
