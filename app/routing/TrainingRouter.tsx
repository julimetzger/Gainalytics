import React from "react";
import TrainingHomeTab from "../tabs/trainings/TrainingHome";
import TrainingsPlanTab from "../tabs/trainings/TrainingsPlanTab";
import {TrainingsPlan} from "../models/TrainingsPlan";
import {createNativeStackNavigator} from "@react-navigation/native-stack";

export type  RootStackParamList = {
    TrainingHome: undefined;
    Training: { trainingsPlan: TrainingsPlan, micro?: number, training?: number }
};

const TrainingRouter = () => {
    const Stack = createNativeStackNavigator<RootStackParamList>();

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
