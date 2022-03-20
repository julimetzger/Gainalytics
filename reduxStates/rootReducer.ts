import exerciseReducer from './Exercises/exercisesReducer';
import {combineReducers} from 'redux';

export interface ExerciseState {
  exercises: Exercise[];
}

export interface GlobalState {
  exercises: ExerciseState;
}

export default combineReducers<GlobalState>({
  exercises: exerciseReducer,
});
