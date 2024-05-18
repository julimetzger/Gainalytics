import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import ExerciseTab from '../tabs/exercises/ExerciseTab';
import AddWorkoutTab from '../tabs/exercises/AddWorkoutTab';
import {IconButton, useTheme} from "react-native-paper";
import {Exercise} from "../models/Exercise";
import ExerciseStatisticsTabs from "../tabs/exercises/ExerciseStatisticsTabs";
import ExerciseHistoryTab from "../tabs/exercises/ExerciseHistoryTab";
import SettingsTab from "../tabs/settings/SettingsTab";
import {useNavigation} from '@react-navigation/native';
import {createNativeStackNavigator} from "@react-navigation/native-stack";

export type RootStackParamList = {
    Exercises: undefined;
    AddWorkoutTab: { exercise: Exercise };
    ExerciseStatisticsTab: { exercise: Exercise };
    ExericseHistory: { exercise: Exercise };
    Settings: undefined;
};

const ExerciseRouter = () => {
    const Stack = createNativeStackNavigator<RootStackParamList>();
    const theme = useTheme();
    return (
        <Stack.Navigator initialRouteName="Exercises"
                         screenOptions={{navigationBarColor: theme.colors.elevation.level0}}>
            <Stack.Screen
                name="Exercises"
                component={ExerciseTab}
                options={({route}) => ({
                    title: route.params ?? "Exercises",
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
