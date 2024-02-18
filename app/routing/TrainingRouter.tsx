import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import TrainingHomeTab from "../tabs/trainings/TrainingHome";
import TrainingsPlanTab from "../tabs/trainings/TrainingsPlanTab";

export type RootStackParamList = {
    TrainingHome: undefined;
    Training: { trainingsPlan: TrainingsPlan };
};

const TrainingRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="TrainingHome">
            <Stack.Screen name="Training Home" component={TrainingHomeTab}/>
            <Stack.Screen name="Training" component={TrainingsPlanTab}
                          options={({route}) => ({title: route.params.trainingsPlan.name})}></Stack.Screen>
        </Stack.Navigator>
    );
};

export default TrainingRouter;
