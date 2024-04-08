import React from 'react';
import ExerciseRouter from './exerciseRouter';
import HistoryRouter from "./HistoryRouter";
import AnalyseRouter from "./AnalyseRouter";
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
    //TODO flo baut nen toast rein - wenn record dann liefert das userExerciseRecord ExerciseRecordEffect zurück. Sobald irgendwas neues gespeichert wird verschwindet der Eintrag wieder und useExerciseRecord liefert null zurück
    let useExerciseRecord1 = useExerciseRecord();
    let exercise = useExercise(useExerciseRecord1?.exerciseId);
    let isTrainingStarted = allTrainings.some(A => A.state === TrainingsState.STARTED)
    if (useExerciseRecord1) {
        Toast.show({
            type: 'info',
            text1: 'New Record!',
            text2: `You have a new ${useExerciseRecord1.record} record in ${exercise?.name} with ${useExerciseRecord1.value}`,
            position: 'top',
            visibilityTime: 5000,
            onPress: () => [] //TODO go to Exercise Stats
        })
    }
    return (
        <Tab.Navigator initialRouteName="Feed" shifting={false} barStyle={{height: 70}}>
            <Tab.Screen
                name="Exercises"
                component={ExerciseRouter}
                options={{
                    tabBarIcon: 'weight-lifter',
                }}
            />
            <Tab.Screen
                name="History"
                component={HistoryRouter}
                options={{
                    tabBarIcon: 'history',
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
                name="Training"
                component={TrainingRouter}
                options={{
                    tabBarIcon: 'book-open-variant',
                    tabBarBadge: isTrainingStarted,
                }}
            />
        </Tab.Navigator>
    );
};
