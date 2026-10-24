import React from 'react';
import TrainingHomeTab from '../tabs/trainings/TrainingHome';
import TrainingsPlanTab from '../tabs/trainings/TrainingsPlanTab';
import {TrainingsPlan} from '../models/entities/TrainingsPlan';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SubTab} from '../components/Training/TrainingModeTabs';
import {trainingsPlanDisplayName} from '../utils/trainings-plan-name';

export type RootStackParamList = {
  // GH-497: the onboarding's "Create an empty plan" opens the add-plan dialog.
  TrainingHome: {openNewPlan?: boolean} | undefined;
  // `subTab` lets a caller land on a specific sub-tab instead of the one derived
  // from the training's state — GH-401: the Next-Training card opens the Train tab
  // so the real "Start Training" control is the first thing the user sees.
  TrainingPlan: {trainingsPlan: TrainingsPlan; micro?: number; training?: number; subTab?: SubTab};
};

// GH-518: created once at module level. Created inside the component, every re-render of the
// tab tree (e.g. App rebuilding the theme after ANY settings change, like starring a plan) made a
// new navigator type and remounted the whole Training stack — scroll position and state were lost.
const Stack = createNativeStackNavigator<RootStackParamList>();

const TrainingRouter = () => {
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
          // GH-428 (H1): the stack title is what shows until TrainingsPlanTab
          // installs its own header, so a legacy plan without a name would flash
          // an empty heading before the fallback label appears.
          title: trainingsPlanDisplayName(route.params.trainingsPlan.name),
        })}
      />
    </Stack.Navigator>
  );
};

export default TrainingRouter;
