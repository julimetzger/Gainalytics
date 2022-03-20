import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import ExerciseTab from '../Exercises/ExerciseTab';
import AddExerciseTab from '../Exercises/AddExerciseTab';

export type RootStackParamList = {
  Exercises: undefined;
  AddExerciseTab: {exercise: Exercise};
};

const RootRouter = () => {
  const Stack = createStackNavigator<RootStackParamList>();
  return (
    <Stack.Navigator initialRouteName="Exercises">
      <Stack.Screen name="Exercises" component={ExerciseTab} />
      <Stack.Screen name="AddExerciseTab" component={AddExerciseTab} options={({route}) => ({title: route.params.exercise.name})} />
    </Stack.Navigator>
  );
};

export default RootRouter;
