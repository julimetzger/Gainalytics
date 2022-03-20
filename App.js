import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import createStackNavigator from '@react-navigation/stack/src/navigators/createStackNavigator';
import Exercise from './Exercises/ExerciseTab';
import ExerciseItem from './Exercises/AddExerciseTab';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import confiugureStore from './confiugureStore';
import RootRouter from './routing/rootRouter';

const {store, persistor} = confiugureStore();

const App: () => React$Node = () => {
  return (
    <>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <NavigationContainer>
            <RootRouter />
          </NavigationContainer>
        </PersistGate>
      </Provider>
    </>
  );
};

export default App;
