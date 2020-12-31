import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import createStackNavigator from '@react-navigation/stack/src/navigators/createStackNavigator';
import Exercise from './Exercises/Exercise';
import ExerciseItem from './Exercises/ExerciseItem';
import {createStore} from 'redux';
import reducer from './Redux/reducer';
import {Provider} from 'react-redux';

const Stack = createStackNavigator();
const store = createStore(reducer);

const App: () => React$Node = () => {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Exercises" component={Exercise} />
          <Stack.Screen name="Exercise" component={ExerciseItem} options={({route}) => ({title: route.params.name})} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
};

export default App;
