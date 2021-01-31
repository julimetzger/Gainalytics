import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import createStackNavigator from '@react-navigation/stack/src/navigators/createStackNavigator';
import Exercise from './Exercises/Exercise';
import ExerciseItem from './Exercises/ExerciseItem';
import {PersistGate} from 'redux-persist/integration/react';
import {Provider} from 'react-redux';
import confiugureStore from './confiugureStore';

const Stack = createStackNavigator();
const {store, persistor} = confiugureStore();

const App: () => React$Node = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Exercises" component={Exercise} />
            <Stack.Screen name="Exercise" component={ExerciseItem} options={({route}) => ({title: route.params.name})} />
          </Stack.Navigator>
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
};

export default App;
