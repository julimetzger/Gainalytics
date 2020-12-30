import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import createStackNavigator from '@react-navigation/stack/src/navigators/createStackNavigator';
import Exercise from './Exercises/Exercise';
import ExerciseItem from './Exercises/ExerciseItem';

const Stack = createStackNavigator();

const App: () => React$Node = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Exercises" component={Exercise} />
        <Stack.Screen name="ExerciseItem" component={ExerciseItem} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
