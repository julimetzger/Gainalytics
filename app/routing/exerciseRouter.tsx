import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import ExerciseTab from '../tabs/exercises/ExerciseTab';
import AddWorkoutTab from '../tabs/exercises/AddWorkoutTab';
import {IconButton} from "react-native-paper";
import {Exercise} from "../models/Exercise";
import ExerciseStatisticsTabs from "../tabs/exercises/ExerciseStatisticsTabs";
import ExerciseHistoryTab from "../tabs/exercises/ExerciseHistoryTab";
import SettingsTab from "../tabs/settings/SettingsTab";
import {useNavigation} from '@react-navigation/native';

export type RootStackParamList = {
    Exercises: undefined;
    AddWorkoutTab: { exercise: Exercise };
    ExerciseStatisticsTab: { exercise: Exercise };
    ExericseHistory: { exercise: Exercise };
    Settings: undefined;
};

const ExerciseRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();
    let navigation = useNavigation();
    return (
        <Stack.Navigator initialRouteName="Exercises">
            <Stack.Screen
                name="Exercises"
                component={ExerciseTab}
                options={({route}) => ({
                    title: route.params ?? "Exercises",
                    headerRight: () => (
                        <IconButton
                            onPress={() => navigation.navigate({name: 'Settings', params: undefined})}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
            <Stack.Screen
                name="AddWorkoutTab"
                component={AddWorkoutTab}
                options={({route}) => ({
                    title: route.params.exercise.name,
                    headerRight: () => (
                        <IconButton
                            onPress={() => navigation.navigate({name: 'Settings', params: undefined})}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
            <Stack.Screen
                name="ExerciseStatisticsTab"
                component={ExerciseStatisticsTabs}
                options={({route}) => ({
                    title: route.params.exercise.name,
                    headerRight: () => (
                        <IconButton
                            onPress={() => navigation.navigate({name: 'Settings', params: undefined})}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
            <Stack.Screen
                name="ExericseHistory"
                component={ExerciseHistoryTab}
                options={({route}) => ({
                    title: route.params.exercise.name,
                    headerRight: () => (
                        <IconButton
                            onPress={() => navigation.navigate({name: 'Settings', params: undefined})}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
            <Stack.Screen
                name="Settings"
                component={SettingsTab}
                options={({route}) => ({
                    title: "Settings"
                })}
            />
        </Stack.Navigator>
    );
};

export default ExerciseRouter;
