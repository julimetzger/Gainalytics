import React from "react";
import SettingsTab from "../tabs/settings/SettingsTab";
import {createNativeStackNavigator} from "@react-navigation/native-stack";

export type RootStackParamList = {
    Settings: undefined;
};

const SettingsRouter = () => {
    const Stack = createNativeStackNavigator<RootStackParamList>();
    return (
        <Stack.Navigator initialRouteName="Settings">
            <Stack.Screen
                name="Settings"
                component={SettingsTab}
            />
        </Stack.Navigator>
    );
};

export default SettingsRouter;
