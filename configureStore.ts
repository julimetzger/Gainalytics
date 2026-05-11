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
import {
  attachPersistorForHotActionSkip,
  flushHotActionState,
  skipPersistOnHotActions,
} from './app/redux/middleware/skipPersistOnHotActions';

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
  // GH-270: must run BEFORE perfMiddleware / paintGapMiddleware so the
  // pause/resume happens around the same `next(action)` they measure. Hot
  // actions therefore record zero `bytes_written_in_tick` / no storage rows
  // in the AFTER CSV — that is the win we are quantifying.
  middleware.push(skipPersistOnHotActions);
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
  // GH-270: hand the persistor to the hot-action middleware so it can call
  // pause/persist around hot dispatches and flush on FINALIZE_WORKOUT.
  attachPersistorForHotActionSkip(persistor, store, persistConfig.key);
  // GH-262 round-2 + GH-270: flush on every active → background/inactive
  // transition. Originally a 16 ms-window closer for the deferred MMKV
  // setItem; under GH-270 it also closes the much bigger window where
  // hot-action state has accumulated under a paused persistor. We use
  // `flushHotActionState` rather than `persistor.flush()` because the
  // persistor's queue is empty after a hot-only cascade — see middleware
  // comment for the REHYDRATE-resync rationale.
  AppState.addEventListener('change', (next) => {
    if (next !== 'active') {
      flushHotActionState();
    }
  });
  // GH-270: 30 s interval flush as a crash-window backup. If the user never
  // backgrounds the app (screen-off mid-workout, force-kill from recents
  // while the activity is still foreground-resumed) this caps the worst-case
  // data-loss window at ~30 s of hot-action state.
  setInterval(() => {
    flushHotActionState();
  }, 30_000);
  return {store, persistor};
};
