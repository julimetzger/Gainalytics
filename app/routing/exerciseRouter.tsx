import React from 'react';
import ExerciseTab from '../tabs/exercises/ExerciseTab';
import ExerciseDetailScreen from '../tabs/exercises/ExerciseDetailScreen';
import EditExerciseSheet from '../tabs/exercises/EditExerciseSheet';
import {useTheme} from 'react-native-paper';
import {Exercise} from '../models/entities/Exercise';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Exercises: undefined;
  AddWorkoutTab: {exercise: Exercise; initialTab?: 'log' | 'stats' | 'history' | 'graph'};
  EditExerciseSheet: {exerciseId?: number};
  Settings: undefined;
};

const ExerciseRouter = () => {
  const Stack = createNativeStackNavigator<RootStackParamList>();
  const theme = useTheme();
  return (
    <Stack.Navigator initialRouteName="Exercises" screenOptions={{navigationBarColor: theme.colors.elevation.level0}}>
      <Stack.Screen
        name="Exercises"
        component={ExerciseTab}
        options={{
          title: 'Exercises',
        }}
      />
      <Stack.Screen
        name="AddWorkoutTab"
        component={ExerciseDetailScreen}
        options={({route}) => ({
          title: route.params.exercise.name,
        })}
      />
      <Stack.Screen
        name="EditExerciseSheet"
        component={EditExerciseSheet}
        options={{
          title: 'New exercise',
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};

export default ExerciseRouter;
