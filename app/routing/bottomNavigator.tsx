import React from 'react';
import ExerciseRouter from './exerciseRouter';
import HistoryRouter from "./HistoryRouter";
import AnalyseRouter from "./AnalyseRouter";
import {createMaterialBottomTabNavigator} from "react-native-paper/react-navigation";

const Tab = createMaterialBottomTabNavigator();

export const BottomTabs = () => {
  return (
    <Tab.Navigator initialRouteName="Feed" shifting={true} sceneAnimationEnabled={false}>
      <Tab.Screen
        name="Exercises"
        component={ExerciseRouter}
        options={{
          tabBarIcon: 'weight-lifter',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryRouter}
        options={{
          tabBarIcon: 'history',
        }}
      />
      <Tab.Screen
        name="Analyse"
        component={AnalyseRouter}
        options={{
          tabBarIcon: 'message-text-outline',
        }}
      />
    </Tab.Navigator>
  );
};
