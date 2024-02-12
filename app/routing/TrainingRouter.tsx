import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import TraingHomeTab from "../tabs/trainings/TraingHome";
import TrainingsPlanTab from "../tabs/trainings/TrainingsPlanTab";

export type RootStackParamList = {
    TrainingHome: undefined;
    Training: { trainingsPlan: TrainingsPlan };
};

const TrainingRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="TrainingHome">
            <Stack.Screen name="TrainingHome" component={TraingHomeTab}/>
            <Stack.Screen name="Training" component={TrainingsPlanTab}
                          options={({route}) => ({title: route.params.trainingsPlan.name})}></Stack.Screen>
        </Stack.Navigator>
    );
};

export default TrainingRouter;
