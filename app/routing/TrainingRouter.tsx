import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import TraingHome from "../tabs/trainings/TraingHome";

export type RootStackParamList = {
    Training: undefined;
};

const TrainingRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="Training">
            <Stack.Screen name="Training" component={TraingHome}/>
        </Stack.Navigator>
    );
};

export default TrainingRouter;
