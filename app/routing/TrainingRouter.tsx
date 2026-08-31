import React from 'react';
import TrainingHomeTab from '../tabs/trainings/TrainingHome';
import TrainingsPlanTab from '../tabs/trainings/TrainingsPlanTab';
import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SubTab} from '../components/Training/TrainingModeTabs';

export type RootStackParamList = {
  TrainingHome: undefined;
  // `subTab` lets a caller land on a specific sub-tab instead of the one derived
  // from the training's state — GH-401: the Next-Training card opens the Train tab
  // so the real "Start Training" control is the first thing the user sees.
  TrainingPlan: {trainingsPlan: TrainingsPlan; micro?: number; training?: number; subTab?: SubTab};
};

const TrainingRouter = () => {
  const Stack = createNativeStackNavigator<RootStackParamList>();

  return (
    <Stack.Navigator initialRouteName="TrainingHome">
      <Stack.Screen
        name="TrainingHome"
        component={TrainingHomeTab}
        // GH-412: no headerRight search icon — the plans list has its own
        // always-visible Searchbar, so a second entry point is redundant.
        options={{
          title: 'Training',
        }}
      />
      <Stack.Screen
        name="TrainingPlan"
        component={TrainingsPlanTab}
        options={({route}) => ({
          title: route.params.trainingsPlan.name,
        })}
      />
    </Stack.Navigator>
  );
};

export default TrainingRouter;
