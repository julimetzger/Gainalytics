import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import History from "../tabs/History";

export type RootStackParamList = {
    History: { exercise: Exercise, lowerRangeBound: Date | undefined };
};

const HistoryRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="History">
            <Stack.Screen name="History" component={History}/>
        </Stack.Navigator>
    );
};

export default HistoryRouter;
