import {AnyAction, combineReducers, Reducer, ReducersMapObject} from 'redux';
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
import fullStateReducer from './fullstateactions/fullStateReducer';
import videoAnalysisReducer from './VideoAnalysis/videoAnalysisReducer';
import aiChatReducer, {AIChatState} from './AIChat/aiChatSlice';
import healthConnectReducer, {HealthConnectState} from './HealthConnect/healthConnectReducer';
import bodyWeightReducer from './BodyWeight/bodyWeightReducer';
import {BodyWeightEntry} from '../models/entities/BodyWeightEntry';

export interface GlobalState {
  exercises: NormalizedState<Exercise>;
  workouts: NormalizedWorkoutState<Workout>;
  trainingsPlan: NormalizedState<TrainingsPlan>;
  trainings: NormalizedState<Training>;
  videoAnalyses: NormalizedState<VideoAnalysis>;
  bodyWeight: NormalizedState<BodyWeightEntry>;
  settings: AppSettings;
  effects: Effects;
  aiChat: AIChatState;
  /** GH-528: optional so states from before Health Connect (backups, test fixtures) stay valid. */
  healthConnect?: HealthConnectState;
}

// Redux 5: combineReducers infers the state from the reducer map (its type parameter is the map,
// not the state); `satisfies` keeps the map checked against GlobalState.
const combinedReducer = combineReducers({
  exercises: exerciseReducer,
  workouts: workoutReducer,
  trainingsPlan: trainingsPlanReducer,
  trainings: trainingsReducer,
  videoAnalyses: videoAnalysisReducer,
  bodyWeight: bodyWeightReducer,
  settings: settingsReducer,
  effects: effectsReducer,
  aiChat: aiChatReducer,
  healthConnect: healthConnectReducer,
} satisfies ReducersMapObject<GlobalState, AnyAction>);

// Same as reduceReducers(combinedReducer, fullStateReducer): the slice reducers first, then the
// cross-cutting full-state actions. Written out so the result is a redux Reducer that accepts the
// undefined initial state — reduce-reducers' own typing does not, which made every
// createStore(rootReducer) / rootReducer(undefined, …) a type error.
const rootReducer: Reducer<GlobalState, AnyAction> = (state, action) => fullStateReducer(combinedReducer(state, action), action);

export default rootReducer;
