import React from 'react';
import {createMaterialBottomTabNavigator} from '@react-navigation/material-bottom-tabs';
import ExerciseRouter from './exerciseRouter';
import History from '../components/History';
import HistoryRouter from "./HistoryRouter";

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
        name="Routines"
        component={ExerciseRouter}
        options={{
          tabBarIcon: 'message-text-outline',
        }}
      />
    </Tab.Navigator>
  );
};
