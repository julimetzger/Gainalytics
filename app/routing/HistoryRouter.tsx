import React from "react";
import History from "../tabs/History";
import {Exercise} from "../models/Exercise";
import {createDrawerNavigator} from '@react-navigation/drawer';
import AnalyseGraphics from "../tabs/AnalyseGraphics";

export type RootStackParamList = {
    History: { exercise: Exercise, lowerRangeBound: Date | undefined };
    Analyse: { exercise: { name: string } };
};

const HistoryRouter = () => {
    const Stack = createDrawerNavigator<RootStackParamList>();

    return (
        <Stack.Navigator initialRouteName="Analyse">
            <Stack.Screen
                name="Analyse"
                component={AnalyseGraphics}
                options={({route}) => ({
                    title: route.params?.exercise?.name ?? "Analyse",
                })}
            />
            <Stack.Screen
                name="History"
                component={History}
                options={({route}) => ({
                    title: route.params?.exercise?.name ?? "History",
                })}
            />
        </Stack.Navigator>
    );
};

export default HistoryRouter;
