import {createMigrate, persistReducer, persistStore, Storage} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {MMKV} from 'react-native-mmkv';
import createFilter from 'redux-persist-transform-filter';
import {configureStore} from '@reduxjs/toolkit';
import logger from 'redux-logger';
import {__DEV_PERF__} from './app/utils/perf/devPerfFlag';
import {createProfilingStorage} from './app/utils/perf/profilingStorage';
import {perfMiddleware} from './app/utils/perf/perfMiddleware';

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
  8: (state) => ({
    ...state,
    aiChat: {
      ...(state.aiChat ?? {messages: [], isLoading: false, error: null, seedContextJson: null}),
      contextRange: null,
    },
  }),
  9: (state) => {
    const oldPauseSeconds = state.settings?.localNotification?.pauseTimerInSeconds;
    const alreadySet = state.settings?.restTimer?.userDefaultSeconds != null;
    if (!alreadySet && oldPauseSeconds != null) {
      return {
        ...state,
        settings: {
          ...state.settings,
          restTimer: {
            ...(state.settings?.restTimer ?? {}),
            userDefaultSeconds: oldPauseSeconds,
          },
        },
      };
    }
    return state;
  },
};

const storage = new MMKV();

// Plain MMKV-backed redux-persist storage adapter — unchanged shape and
// contract. The profiling wrapper below only adds timing records and is
// strictly a measurement layer.
const baseStorage: Storage = {
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

export const reduxStorage: Storage = __DEV_PERF__
  ? createProfilingStorage(storage)
  : baseStorage;

const saveUserLoginSubsetFilter = createFilter('workouts', ['byId', 'byExerciseId', 'allIds', 'plannedWorkouts']);

const persistConfig = {
  key: 'root',
  version: 9,
  storage: reduxStorage,
  whitelist: ['exercises', 'workouts', 'trainingsPlan', 'trainings', 'videoAnalyses', 'settings', 'aiChat'],
  stateReconciler: hardSet,
  transforms: [saveUserLoginSubsetFilter],
  migrate: createMigrate(migrations, {debug: true}),
};

// @ts-ignore
const persistedReducer = persistReducer(persistConfig, rootReducer);

export default () => {
  const isDev = process?.env?.NODE_ENV === 'development';
  const middleware: any[] = [];
  if (__DEV_PERF__) middleware.push(perfMiddleware);
  // redux-logger dominates dispatch time on a 1.7 MB store and would mask
  // the persist costs we are trying to measure. With perf instrumentation
  // on, leave logger out so the per-dispatch numbers reflect reducer +
  // persist debounce only.
  if (isDev && !__DEV_PERF__) middleware.push(logger);
  const store = configureStore({
    reducer: persistedReducer,
    devTools: isDev,
    middleware,
  });
  let persistor = persistStore(store);
  return {store, persistor};
};
