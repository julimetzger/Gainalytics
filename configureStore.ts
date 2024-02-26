import {createMigrate, persistReducer, persistStore, Storage} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {MMKV} from "react-native-mmkv"
import createFilter from 'redux-persist-transform-filter';
import {configureStore} from "@reduxjs/toolkit";
import logger from "redux-logger";

const migrations = {
    0: state => {
        return {
            ...state,
            workouts: {
                ...state.workouts,
                byExerciseId: {},
            }
        }
    },
    1: state => {
        return {
            ...state,
            trainingsPlan: {
                ...state.trainingsPlan,
                byId: {},
                allIds: []
            },
            trainings: {
                ...state.trainings,
                byId: {},
                allIds: []
            }
        }
    },
    2: state => {
        return {
            ...state,
            workouts: {
                ...state.workouts,
                plannedWorkouts: []
            }
        }
    }
}


const storage = new MMKV()

export const reduxStorage: Storage = {
    setItem: (key, value) => {
        storage.set(key, value)
        return Promise.resolve(true)
    },
    getItem: (key) => {
        const value = storage.getString(key)
        return Promise.resolve(value)
    },
    removeItem: (key) => {
        storage.delete(key)
        return Promise.resolve()
    },
}

const saveUserLoginSubsetFilter = createFilter("workouts", ["byId", "byExerciseId", "allIds", "plannedWorkouts"]);

const persistConfig = {
    key: 'root',
    version: 2,
    storage: reduxStorage,
    whitelist: ['exercises', 'workouts', 'trainingsPlan', 'trainings'],
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
        middleware: process?.env?.NODE_ENV === 'development' ? [logger] : []
    });
    let persistor = persistStore(store);
    return {store, persistor};
};
