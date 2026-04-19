import {createMigrate, persistReducer, persistStore, Storage} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {MMKV} from 'react-native-mmkv';
import createFilter from 'redux-persist-transform-filter';
import {configureStore} from '@reduxjs/toolkit';
import logger from 'redux-logger';

const migrations = {
  0: (state) => {
    return {
      ...state,
      workouts: {
        ...state.workouts,
        byExerciseId: {},
      },
    };
  },
  1: (state) => {
    return {
      ...state,
      trainingsPlan: {
        ...state.trainingsPlan,
        byId: {},
        allIds: [],
      },
      trainings: {
        ...state.trainings,
        byId: {},
        allIds: [],
      },
    };
  },
  2: (state) => {
    return {
      ...state,
      workouts: {
        ...state.workouts,
        plannedWorkouts: [],
      },
    };
  },
  3: (state) => {
    return {
      ...state,
      videoAnalyses: {
        byId: {},
        allIds: [],
      },
    };
  },
  4: (state) => {
    return {
      ...state,
      videoAnalyses: {
        byId: {},
        allIds: [],
      },
    };
  },
  5: (state) => {
    const byId = {...(state.trainingsPlan?.byId ?? {})};
    Object.keys(byId).forEach((id) => {
      const plan = byId[id];
      if (!plan.mesos || plan.mesos.length === 0) {
        byId[id] = {
          ...plan,
          mesos: [{id: 1, name: 'Meso 1', order: 1, startMicro: 1}],
        };
      }
    });
    return {
      ...state,
      trainingsPlan: {
        ...(state.trainingsPlan ?? {byId: {}, allIds: []}),
        byId,
      },
    };
  },
  6: (state) => ({
    ...state,
    aiChat: {messages: [], isLoading: false, error: null},
  }),
  7: (state) => ({
    ...state,
    aiChat: {
      ...(state.aiChat ?? {messages: [], isLoading: false, error: null}),
      seedContextJson: null,
    },
  }),
};

const storage = new MMKV();

export const reduxStorage: Storage = {
  setItem: (key, value) => {
    storage.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key) => {
    const value = storage.getString(key);
    return Promise.resolve(value);
  },
  removeItem: (key) => {
    storage.delete(key);
    return Promise.resolve();
  },
};

const saveUserLoginSubsetFilter = createFilter('workouts', ['byId', 'byExerciseId', 'allIds', 'plannedWorkouts']);

const persistConfig = {
  key: 'root',
  version: 7,
  storage: reduxStorage,
  whitelist: ['exercises', 'workouts', 'trainingsPlan', 'trainings', 'videoAnalyses', 'settings', 'aiChat'],
  stateReconciler: hardSet,
  transforms: [saveUserLoginSubsetFilter],
  migrate: createMigrate(migrations, {debug: true}),
};

// @ts-ignore
const persistedReducer = persistReducer(persistConfig, rootReducer);

export default () => {
  const store = configureStore({
    reducer: persistedReducer,
    devTools: process?.env?.NODE_ENV === 'development',
    middleware: process?.env?.NODE_ENV === 'development' ? [logger] : [],
  });
  let persistor = persistStore(store);
  return {store, persistor};
};
