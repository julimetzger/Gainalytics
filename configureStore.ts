import {createMigrate, persistReducer, persistStore, Storage} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {MMKV} from 'react-native-mmkv';
import createFilter from 'redux-persist-transform-filter';
import {configureStore} from '@reduxjs/toolkit';
import logger from 'redux-logger';

export const migrations = {
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
  10: (state) => {
    // GH-300: split the single Plan-View compare selection into per-view selections.
    // Keep the existing value as the Plan default so behaviour is unchanged on upgrade.
    const legacyCompare = state?.settings?.plan?.muscleMap?.compare;
    return {
      ...state,
      settings: {
        ...(state?.settings ?? {}),
        muscleMapCompareSelectionPlan: state?.settings?.muscleMapCompareSelectionPlan ?? legacyCompare ?? 'current_total_plan',
        muscleMapCompareSelectionAnalyse: state?.settings?.muscleMapCompareSelectionAnalyse ?? 'last_training_done',
      },
    };
  },
  11: (state: any) => {
    // GH-293: chat history. A pre-existing conversation must become the first
    // history entry, but archiving needs an async file write — so the migration
    // only sets a flag; AIChatTab performs the actual archival on next open.
    const aiChat = state?.aiChat ?? {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null};
    return {
      ...state,
      aiChat: {
        ...aiChat,
        history: aiChat.history ?? [],
        pendingLegacyArchive: (aiChat.messages?.length ?? 0) > 0,
      },
    };
  },
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
  version: 11,
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
