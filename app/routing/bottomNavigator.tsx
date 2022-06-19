import React from 'react';
import {createMaterialBottomTabNavigator} from '@react-navigation/material-bottom-tabs';
import RootRouter from './rootRouter';

const Tab = createMaterialBottomTabNavigator();

export const BottomTabs = () => {
  return (
    <Tab.Navigator initialRouteName="Feed" shifting={true} sceneAnimationEnabled={false}>
      <Tab.Screen
        name="Exercises"
        component={RootRouter}
        options={{
          tabBarIcon: 'weight-lifter',
        }}
      />
      <Tab.Screen
        name="History"
        component={RootRouter}
        options={{
          tabBarIcon: 'history',
        }}
      />
      <Tab.Screen
        name="Routines"
        component={RootRouter}
        options={{
          tabBarIcon: 'message-text-outline',
        }}
      />
    </Tab.Navigator>
  );
};
