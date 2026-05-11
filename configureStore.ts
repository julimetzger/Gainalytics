import {createMigrate, persistReducer, persistStore, Storage} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {MMKV} from 'react-native-mmkv';
import createFilter from 'redux-persist-transform-filter';
import {configureStore} from '@reduxjs/toolkit';
import logger from 'redux-logger';
import {AppState} from 'react-native';
import {__DEV_PERF__} from './app/utils/perf/devPerfFlag';
import {createBaseStorage} from './app/utils/perf/createBaseStorage';
import {createProfilingStorage} from './app/utils/perf/profilingStorage';
import {perfMiddleware} from './app/utils/perf/perfMiddleware';
import {paintGapMiddleware} from './app/utils/perf/paintGapMiddleware';

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

const baseStorage: Storage = createBaseStorage(storage);

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
  throttle: 250,
};

// @ts-ignore
const persistedReducer = persistReducer(persistConfig, rootReducer);

export default () => {
  const isDev = process?.env?.NODE_ENV === 'development';
  const middleware: any[] = [];
  if (__DEV_PERF__) middleware.push(perfMiddleware);
  // GH-267: per-dispatch entry/return + rAF paint-observed timestamps so the
  // ~365 ms gap between perfMiddleware's totalMs and instrumentSubmitTiming's
  // t2-t0 can be attributed to React commit + native paint specifically.
  if (__DEV_PERF__) middleware.push(paintGapMiddleware);
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
  // GH-262 round-2: with `setItem` deferred to a macrotask, a hard kill in
  // the ~16 ms window between dispatch and the persist write would lose the
  // latest state. Flush on every active → background/inactive transition so
  // a swipe-away or recents-clear always lands the latest in-memory state
  // on disk. `flush()` calls into the same storage adapter, but at that
  // point we are off the critical-render path so the synchronous write is
  // fine.
  AppState.addEventListener('change', (next) => {
    if (next !== 'active') {
      persistor.flush();
    }
  });
  return {store, persistor};
};
