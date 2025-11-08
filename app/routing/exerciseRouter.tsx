import React from 'react';
import ExerciseTab from '../tabs/exercises/ExerciseTab';
import AddWorkoutTab from '../tabs/exercises/AddWorkoutTab';
import {useTheme, IconButton} from 'react-native-paper';
import {Exercise} from '../models/Exercise';
import ExerciseStatisticsTabs from '../tabs/exercises/ExerciseStatisticsTabs';
import ExerciseHistoryTab from '../tabs/exercises/ExerciseHistoryTab';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Exercises: undefined;
  AddWorkoutTab: {exercise: Exercise};
  ExerciseStatisticsTab: {exercise: Exercise};
  ExericseHistory: {exercise: Exercise};
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
        options={({navigation}) => ({
          title: 'Exercises',
          headerRight: () => <IconButton icon="magnify" onPress={() => navigation.setParams({toggleFilter: true})}></IconButton>,
        })}
      />
      <Stack.Screen
        name="AddWorkoutTab"
        component={AddWorkoutTab}
        options={({route}) => ({
          title: route.params.exercise.name,
        })}
      />
      <Stack.Screen
        name="ExerciseStatisticsTab"
        component={ExerciseStatisticsTabs}
        options={({route}) => ({
          title: route.params.exercise.name,
        })}
      />
      <Stack.Screen
        name="ExericseHistory"
        component={ExerciseHistoryTab}
        options={({route}) => ({
          title: route.params.exercise.name,
        })}
      />
    </Stack.Navigator>
  );
};

export default ExerciseRouter;
