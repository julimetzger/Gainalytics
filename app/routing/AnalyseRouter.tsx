import { createStackNavigator } from "@react-navigation/stack";
import React from "react";
import AnalyseGraphics from "../tabs/AnalyseGraphics";
import { IconButton } from "react-native-paper";
import {dispatchtoggleMode} from "../redux/settings/dispatchtoggleMode";

export type RootStackParamList = {
    Analyse: { exercise: { name: string } };
};

const AnalyseRouter = () => {
    let dispatchtoggleMode1 = dispatchtoggleMode();
    const Stack = createStackNavigator<RootStackParamList>();
    
    return (
        <Stack.Navigator initialRouteName="Analyse">
            <Stack.Screen
                name="Analyse"
                component={AnalyseGraphics}
                options={({ route }) => ({
                    title: route.params?.exercise?.name ?? "Analyse",
                    headerRight: () => (
                        <IconButton
                            icon="cog"
                            size={20}
                            onPress={dispatchtoggleMode1}
                        />
                    ),
                })}
            />
        </Stack.Navigator>
    );
};

export default AnalyseRouter;
