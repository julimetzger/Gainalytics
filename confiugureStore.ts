import {applyMiddleware, createStore} from 'redux';
import {persistStore, persistReducer, createMigrate} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {composeWithDevTools} from 'redux-devtools-extension';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createLogger} from "redux-logger";
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

const saveUserLoginSubsetFilter = createFilter("workouts", ["notFinishedWorkouts"]);

const persistConfig = {
    key: 'root',
    version: 0,
    storage: AsyncStorage,
    whitelist: ['exercises', 'workouts'],
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
