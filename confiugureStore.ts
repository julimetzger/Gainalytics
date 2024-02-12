import {applyMiddleware, createStore} from 'redux';
import {persistStore, persistReducer, createMigrate} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {composeWithDevTools} from 'redux-devtools-extension';
import {createLogger} from "redux-logger";
import { Storage } from 'redux-persist'
import { MMKV } from "react-native-mmkv"
import createFilter from 'redux-persist-transform-filter';

const migrations = {
    0: state => {
        return {
            ...state,
            workouts: {
                ...state.workouts,
                byExerciseId: {},
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
    version: 0,
    storage: reduxStorage,
    whitelist: ['exercises', 'workouts', 'trainingsPlan', 'trainings'],
    stateReconciler: hardSet,
    transforms: [saveUserLoginSubsetFilter],
    migrate: createMigrate(migrations, {debug: true}),
};

// @ts-ignore
const persistedReducer = persistReducer(persistConfig, rootReducer);

export default () => {
    let store = createStore(persistedReducer, composeWithDevTools(applyMiddleware(createLogger())));
    let persistor = persistStore(store);
    return {store, persistor};
};
