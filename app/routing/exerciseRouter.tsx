import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import ExerciseTab from '../tabs/exercises/ExerciseTab';
import AddWorkoutTab from '../tabs/exercises/AddWorkoutTab';
import {IconButton} from "react-native-paper";
import {dispatchtoggleMode} from "../redux/settings/dispatchtoggleMode";
import {Exercise} from "../models/Exercise";
import ExerciseStatisticsTabs from "../tabs/exercises/ExerciseStatisticsTabs";
import ExerciseHistory from "../tabs/exercises/ExerciseHistory";

export type RootStackParamList = {
    Exercises: undefined;
    AddWorkoutTab: { exercise: Exercise };
    ExerciseStatisticsTab: { exercise: Exercise };
    ExericseHistory: { exercise: Exercise };
};

const ExerciseRouter = () => {
    let dispatchtoggleMode1 = dispatchtoggleMode();
    const Stack = createStackNavigator<RootStackParamList>();

    return (
        <Stack.Navigator initialRouteName="Exercises">
            <Stack.Screen
                name="Exercises"
                component={ExerciseTab}
                options={({ route }) => ({
                    title: route.params?? "Exercises",
                    headerRight: () => (
                        <IconButton
                            onPress={dispatchtoggleMode1}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
            <Stack.Screen
                name="AddWorkoutTab"
                component={AddWorkoutTab}
                options={({ route }) => ({
                    title: route.params.exercise.name,
                    headerRight: () => (
                        <IconButton
                            onPress={dispatchtoggleMode1}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
            <Stack.Screen
                name="ExerciseStatisticsTab"
                component={ExerciseStatisticsTabs}
                options={({ route }) => ({
                    title: route.params.exercise.name,
                    headerRight: () => (
                        <IconButton
                            onPress={dispatchtoggleMode1}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
            <Stack.Screen
                name="ExericseHistory"
                component={ExerciseHistory}
                options={({ route }) => ({
                    title: route.params.exercise.name,
                    headerRight: () => (
                        <IconButton
                            onPress={dispatchtoggleMode1}
                            icon="cog"
                            size={20}
                        />
                    )
                })}
            />
        </Stack.Navigator>
    );
};

export default ExerciseRouter;
