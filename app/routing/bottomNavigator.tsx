import React from 'react';
import ExerciseRouter from './exerciseRouter';
import AnalyseRouter from './AnalyseRouter';
import SettingsRouter from './SettingsRouter';
import {createMaterialBottomTabNavigator} from 'react-native-paper/react-navigation';
import TrainingRouter from './TrainingRouter';
import {useTrainings} from '../redux/Training/use/useTrainings';
import {TrainingsState} from '../models/TrainingsState';
import useExerciseRecord from '../redux/Effects/useExerciseRecord';
import Toast from 'react-native-toast-message';
import {useSettings} from '../redux/settings/use/useSettings';
import {useExercise} from '../redux/Exercises/use/useExercise';
import {useNavigation} from '@react-navigation/native';
import {DevPerfProfiler} from '../utils/perf/DevPerfProfiler';

const Tab = createMaterialBottomTabNavigator();

const TrainingTabRoot = () => <DevPerfProfiler id="tab-training"><TrainingRouter /></DevPerfProfiler>;
const ExerciseTabRoot = () => <DevPerfProfiler id="tab-exercises"><ExerciseRouter /></DevPerfProfiler>;
const AnalyseTabRoot = () => <DevPerfProfiler id="tab-analyse"><AnalyseRouter /></DevPerfProfiler>;
const SettingsTabRoot = () => <DevPerfProfiler id="tab-settings"><SettingsRouter /></DevPerfProfiler>;

export const BottomTabs = () => {
  const navigation = useNavigation();
  const settings = useSettings();
  const allTrainings = useTrainings();
  let useExerciseRecord1 = useExerciseRecord();
  let exercise = useExercise(useExerciseRecord1?.exerciseId);
  let isTrainingStarted = allTrainings.some((A) => A.state === TrainingsState.STARTED);

  React.useEffect(() => {
    if (useExerciseRecord1 && exercise && !settings.toggles?.disableToasts) {
      Toast.show({
        type: 'success',
        text1: 'New Record!',
        text2: `You have a new ${useExerciseRecord1.record} record in ${exercise?.name} with ${useExerciseRecord1.value}`,
        position: 'top',
        visibilityTime: 5000,
        onPress: () => {
          navigation.navigate({
            name: 'Exercises',
            params: {
              screen: 'AddWorkoutTab',
              params: {exercise: exercise, initialTab: 'stats'},
            },
          } as never);
        },
      });
    }
  }, [useExerciseRecord1, exercise, navigation, settings.toggles?.disableToasts]);

  return (
    <Tab.Navigator initialRouteName="Training" shifting={true}>
      <Tab.Screen
        name="Training"
        component={TrainingTabRoot}
        options={{
          tabBarIcon: 'book-open-variant',
          tabBarBadge: isTrainingStarted,
          tabBarAccessibilityLabel: 'tab-training',
          tabBarTestID: 'tab-training',
        }}
      />
      <Tab.Screen
        name="Exercises"
        component={ExerciseTabRoot}
        options={{
          tabBarIcon: 'weight-lifter',
          tabBarAccessibilityLabel: 'tab-exercises',
          tabBarTestID: 'tab-exercises',
        }}
      />
      <Tab.Screen
        name="Analyse"
        component={AnalyseTabRoot}
        options={{
          tabBarIcon: 'trending-up',
          tabBarAccessibilityLabel: 'tab-analyse',
          tabBarTestID: 'tab-analyse',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsTabRoot}
        options={{
          tabBarIcon: 'cog',
          tabBarAccessibilityLabel: 'tab-settings',
          tabBarTestID: 'tab-settings',
        }}
      />
    </Tab.Navigator>
  );
};
