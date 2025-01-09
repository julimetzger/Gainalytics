import React from 'react';
import ExerciseRouter from './exerciseRouter';
import AnalyseRouter from "./AnalyseRouter";
import SettingsRouter from "./SettingsRouter";
import {createMaterialBottomTabNavigator} from "react-native-paper/react-navigation";
import TrainingRouter from "./TrainingRouter";
import {useTrainings} from '../redux/Training/useTrainings';
import {TrainingsState} from '../models/TrainingsState';
import useExerciseRecord from "../redux/Effects/useExerciseRecord";
import Toast from "react-native-toast-message";
import {useExercise} from "../redux/Exercises/useExercise";

const Tab = createMaterialBottomTabNavigator();

export const BottomTabs = () => {
    const allTrainings = useTrainings();
    let useExerciseRecord1 = useExerciseRecord();
    let exercise = useExercise(useExerciseRecord1?.exerciseId);
    let isTrainingStarted = allTrainings.some(A => A.state === TrainingsState.STARTED)
    if (useExerciseRecord1) {
        Toast.show({
            type: 'success',
            text1: 'New Record!',
            text2: `You have a new ${useExerciseRecord1.record} record in ${exercise?.name} with ${useExerciseRecord1.value}`,
            position: 'top',
            visibilityTime: 5000,
            onPress: () => [] //TODO go to Exercise Stats
        })
    }
    return (
        <Tab.Navigator initialRouteName="Feed" shifting={false} >
            <Tab.Screen
                name="Training"
                component={TrainingRouter}
                options={{
                    tabBarIcon: 'book-open-variant',
                    tabBarBadge: isTrainingStarted,
                }}
            />
            <Tab.Screen
                name="Exercises"
                component={ExerciseRouter}
                options={{
                    tabBarIcon: 'weight-lifter',
                }}
            />
            <Tab.Screen
                name="Analyse"
                component={AnalyseRouter}
                options={{
                    tabBarIcon: 'trending-up',
                }}
            />
            <Tab.Screen
                name="Settings"
                component={SettingsRouter}
                options={{
                    tabBarIcon: 'cog',
                }}
            />
        </Tab.Navigator>
    );
};
