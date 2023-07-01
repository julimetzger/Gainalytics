import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import AnalyseGraphics from "../tabs/AnalyseGraphics";

export type RootStackParamList = {
    Analyse: undefined;
};

const AnalyseRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="Analyse">
            <Stack.Screen name="Analyse" component={AnalyseGraphics}/>
        </Stack.Navigator>
    );
};

export default AnalyseRouter;
