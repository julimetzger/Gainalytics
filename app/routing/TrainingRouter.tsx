import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import TrainingHomeTab from "../tabs/trainings/TrainingHome";
import TrainingsPlanTab from "../tabs/trainings/TrainingsPlanTab";
import { IconButton } from "react-native-paper";
import { dispatchtoggleMode } from "../redux/settings/dispatchtoggleMode";
import {TrainingsPlan} from "../models/TrainingsPlan";

export type RootStackParamList = {
    TrainingHome: undefined;
    Training: { trainingsPlan: TrainingsPlan };
};

const TrainingRouter = () => {
    let dispatchtoggleMode1 = dispatchtoggleMode();
    const Stack = createStackNavigator<RootStackParamList>();

    return (
        <Stack.Navigator initialRouteName="TrainingHome">
            <Stack.Screen
                name="TrainingHome"
                component={TrainingHomeTab}
                options={({ route }) => ({
                    title: route.params?? "Training Home",
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
                name="Training"
                component={TrainingsPlanTab}
                options={({route}) => ({
                    title: route.params.trainingsPlan.name,
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

export default TrainingRouter;
