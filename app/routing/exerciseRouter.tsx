import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import ExerciseTab from '../tabs/exercises/ExerciseTab';
import AddWorkoutTab from '../tabs/exercises/AddWorkoutTab';
import {IconButton} from "react-native-paper";
import {dispatchtoggleMode} from "../redux/settings/dispatchtoggleMode";

export type RootStackParamList = {
    Exercises: undefined;
    AddWorkoutTab: { exercise: Exercise };
};

const ExerciseRouter = () => {
    let dispatchtoggleMode1 = dispatchtoggleMode();
    const Stack = createStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="Exercises">
            <Stack.Screen name="Exercises" component={ExerciseTab}/>
            <Stack.Screen name="AddWorkoutTab" component={AddWorkoutTab}
                          options={({route}) => ({title: route.params.exercise.name, headerRight: ()=>
                          <IconButton onPress={dispatchtoggleMode1}icon="cog" size={20}/>})}
            ></Stack.Screen>
        </Stack.Navigator>
    );
};

export default ExerciseRouter;
