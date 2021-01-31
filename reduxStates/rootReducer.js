import exerciseReducer from './Exercises/exercisesReducer';
import {combineReducers} from 'redux';

export default combineReducers({
  exercises: exerciseReducer,
});
