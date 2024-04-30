import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import AnalyseGraphics from "../tabs/AnalyseGraphics";
import {IconButton} from "react-native-paper";
import {dispatchtoggleMode} from "../redux/settings/dispatchtoggleMode";
import SettingsTab from "../tabs/settings/SettingsTab";

export type RootStackParamList = {
    Settings: undefined;
};

const AnalyseRouter = () => {
    const Stack = createStackNavigator<RootStackParamList>();

    return (
        <Stack.Navigator initialRouteName="Settings">
            <Stack.Screen
                name="Settings"
                component={SettingsTab}
            />
        </Stack.Navigator>
    );
};

export default AnalyseRouter;
