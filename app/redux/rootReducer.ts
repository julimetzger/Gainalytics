import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';
import {NormalizedState} from './normalizedState';
import workoutReducer from './Workout/workoutReducer';
import {NormalizedWorkoutState} from './normalizedWorkoutState';
import trainingsPlanReducer from './Training/trainingsPlanReducer';
import trainingsReducer from './Training/trainingsReducer';
import settingsReducer, {AppSettings} from './settings/settingsReducer';
import {Exercise} from '../models/Exercise';
import {Training} from '../models/Training';
import {Workout} from '../models/Workout';
import {TrainingsPlan} from '../models/TrainingsPlan';
import effectsReducer, {Effects} from './Effects/effectsReducer';
import reduceReducers from 'reduce-reducers';
import fullStateReducer from './fullstateactions/fullStateReducer';

export interface GlobalState {
  exercises: NormalizedState<Exercise>;
  workouts: NormalizedWorkoutState<Workout>;
  trainingsPlan: NormalizedState<TrainingsPlan>;
  trainings: NormalizedState<Training>;
  settings: AppSettings;
  effects: Effects;
}

export default reduceReducers(
  combineReducers<GlobalState>({
    exercises: exerciseReducer,
    workouts: workoutReducer,
    trainingsPlan: trainingsPlanReducer,
    trainings: trainingsReducer,
    settings: settingsReducer,
    effects: effectsReducer,
  }),
  fullStateReducer,
);
