import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import History from "../tabs/History";
import {dispatchtoggleMode} from "../redux/settings/dispatchtoggleMode";
import { IconButton } from "react-native-paper";
import {Exercise} from "../models/Exercise";

export type RootStackParamList = {
    History: { exercise: Exercise, lowerRangeBound: Date | undefined };
};

const HistoryRouter = () => {
    let dispatchtoggleMode1 = dispatchtoggleMode();
    const Stack = createStackNavigator<RootStackParamList>();

    return (
        <Stack.Navigator initialRouteName="History">
            <Stack.Screen
                name="History"
                component={History}
                options={({ route }) => ({
                    title: route.params?.exercise?.name ?? "History",
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

export default HistoryRouter;
