import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import ExerciseTab from '../tabs/ExerciseTab';
import AddExerciseTab from '../tabs/AddExerciseTab';

export type RootStackParamList = {
  Exercises: undefined;
  AddExerciseTab: {exercise: Exercise};
};

const ExerciseRouter = () => {
  const Stack = createStackNavigator<RootStackParamList>();
  return (
    <Stack.Navigator initialRouteName="Exercises">
      <Stack.Screen name="Exercises" component={ExerciseTab} />
      <Stack.Screen name="AddExerciseTab" component={AddExerciseTab} options={({route}) => ({title: route.params.exercise.name})} />
    </Stack.Navigator>
  );
};

export default ExerciseRouter;
