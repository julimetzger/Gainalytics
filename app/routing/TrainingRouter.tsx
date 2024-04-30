import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import TrainingHomeTab from "../tabs/trainings/TrainingHome";
import TrainingsPlanTab from "../tabs/trainings/TrainingsPlanTab";
import {IconButton} from "react-native-paper";
import {dispatchtoggleMode} from "../redux/settings/dispatchtoggleMode";
import {TrainingsPlan} from "../models/TrainingsPlan";

export type  RootStackParamList = {
    TrainingHome: undefined;
    Training: { trainingsPlan: TrainingsPlan, micro?: number, training?: number }
};

const TrainingRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();

    return (
        <Stack.Navigator initialRouteName="TrainingHome">
            <Stack.Screen
                name="TrainingHome"
                component={TrainingHomeTab}
                options={({route}) => ({
                    title: route.params ?? "Training Home",
                })}
            />
            <Stack.Screen
                name="Training"
                component={TrainingsPlanTab}
                options={({route}) => ({
                    title: route.params.trainingsPlan.name,
                })}
            />
        </Stack.Navigator>
    );
};

export default TrainingRouter;
