import {applyMiddleware, createStore} from 'redux';
import {persistStore, persistReducer} from 'redux-persist';
import rootReducer from './app/redux/rootReducer';
import AsyncStorage from '@react-native-community/async-storage';
import {createLogger} from 'redux-logger';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';
import {composeWithDevTools} from 'redux-devtools-extension';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['exercises'],
  stateReconciler: hardSet,
};

// @ts-ignore
const persistedReducer = persistReducer(persistConfig, rootReducer);

export default () => {
  let store = createStore(persistedReducer, composeWithDevTools(applyMiddleware(createLogger())));
  let persistor = persistStore(store);
  return {store, persistor};
};
