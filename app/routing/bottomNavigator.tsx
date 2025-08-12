import React, {lazy, Suspense} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import {createMaterialBottomTabNavigator} from "react-native-paper/react-navigation";
import {useTrainings} from '../redux/Training/useTrainings';
import {TrainingsState} from '../models/TrainingsState';
import useExerciseRecord from "../redux/Effects/useExerciseRecord";
import Toast from "react-native-toast-message";
import {useExercise} from "../redux/Exercises/useExercise";
import { useNavigation } from '@react-navigation/native';

// Lazy load components
const ExerciseRouter = lazy(() => import('./exerciseRouter'));
const AnalyseRouter = lazy(() => import("./AnalyseRouter"));
const SettingsRouter = lazy(() => import("./SettingsRouter"));
const TrainingRouter = lazy(() => import("./TrainingRouter"));

const LoadingComponent = () => {
    const theme = useTheme();
    return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background}}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
    );
};

const Tab = createMaterialBottomTabNavigator();

export const BottomTabs = () => {
    const navigation = useNavigation();
    const allTrainings = useTrainings();
    let useExerciseRecord1 = useExerciseRecord();
    let exercise = useExercise(useExerciseRecord1?.exerciseId);
    let isTrainingStarted = allTrainings.some(A => A.state === TrainingsState.STARTED);

    React.useEffect(() => {
        if (useExerciseRecord1 && exercise) {
            Toast.show({
                type: 'success',
                text1: 'New Record!',
                text2: `You have a new ${useExerciseRecord1.record} record in ${exercise?.name} with ${useExerciseRecord1.value}`,
                position: 'top',
                visibilityTime: 5000,
                onPress: () => {
                    navigation.navigate({
                        name: 'Exercises',
                        params: {
                            screen: 'ExerciseStatisticsTab',
                            params: { exercise: exercise }
                        }
                    } as never);
                }
            });
        }
    }, [useExerciseRecord1, exercise, navigation]);

    return (
        <Tab.Navigator 
            initialRouteName="Feed" 
            shifting={true}
        >
            <Tab.Screen
                name="Training"
                options={{
                    tabBarIcon: 'book-open-variant',
                    tabBarBadge: isTrainingStarted,
                }}
            >
                {() => (
                    <Suspense fallback={<LoadingComponent />}>
                        <TrainingRouter />
                    </Suspense>
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Exercises"
                options={{
                    tabBarIcon: 'weight-lifter',
                }}
            >
                {() => (
                    <Suspense fallback={<LoadingComponent />}>
                        <ExerciseRouter />
                    </Suspense>
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Analyse"
                options={{
                    tabBarIcon: 'trending-up',
                }}
            >
                {() => (
                    <Suspense fallback={<LoadingComponent />}>
                        <AnalyseRouter />
                    </Suspense>
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Settings"
                options={{
                    tabBarIcon: 'cog',
                }}
            >
                {() => (
                    <Suspense fallback={<LoadingComponent />}>
                        <SettingsRouter />
                    </Suspense>
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
};
