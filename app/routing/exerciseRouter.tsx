import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import ExerciseTab from '../tabs/ExerciseTab';
import AddWorkoutTab from '../tabs/AddWorkoutTab';

export type RootStackParamList = {
    Exercises: undefined;
    AddWorkoutTab: { exercise: Exercise };
};

const ExerciseRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="Exercises">
            <Stack.Screen name="Exercises" component={ExerciseTab}/>
            <Stack.Screen name="AddWorkoutTab" component={AddWorkoutTab}
                          options={({route}) => ({title: route.params.exercise.name})}></Stack.Screen>
        </Stack.Navigator>
    );
};

export default ExerciseRouter;
