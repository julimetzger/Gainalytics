import {combineReducers} from 'redux';
import exerciseReducer from './Exercises/exercisesReducer';
import {NormalizedState} from './normalizedState';
import workoutReducer from './Workout/workoutReducer';
import {NormalizedWorkoutState} from './normalizedWorkoutState';
import trainingsPlanReducer from './Training/trainingsPlanReducer';
import trainingsReducer from './Training/trainingsReducer';
import settingsReducer, {AppSettings} from './settings/settingsReducer';
import {Exercise} from '../models/entities/Exercise';
import {Training} from '../models/entities/Training';
import {Workout} from '../models/entities/Workout';
import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {VideoAnalysis} from '../models/entities/VideoAnalysis';
import effectsReducer, {Effects} from './Effects/effectsReducer';
import reduceReducers from 'reduce-reducers';
import fullStateReducer from './fullstateactions/fullStateReducer';
import videoAnalysisReducer from './VideoAnalysis/videoAnalysisReducer';
import aiChatReducer, {AIChatState} from './AIChat/aiChatSlice';

export interface GlobalState {
  exercises: NormalizedState<Exercise>;
  workouts: NormalizedWorkoutState<Workout>;
  trainingsPlan: NormalizedState<TrainingsPlan>;
  trainings: NormalizedState<Training>;
  videoAnalyses: NormalizedState<VideoAnalysis>;
  settings: AppSettings;
  effects: Effects;
  aiChat: AIChatState;
}

export default reduceReducers(
  combineReducers<GlobalState>({
    exercises: exerciseReducer,
    workouts: workoutReducer,
    trainingsPlan: trainingsPlanReducer,
    trainings: trainingsReducer,
    videoAnalyses: videoAnalysisReducer,
    settings: settingsReducer,
    effects: effectsReducer,
    aiChat: aiChatReducer,
  }),
  fullStateReducer,
);
