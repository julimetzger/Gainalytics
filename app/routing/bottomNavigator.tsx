import React from 'react';
import ExerciseRouter from './exerciseRouter';
import AnalyseRouter from './AnalyseRouter';
import SettingsRouter from './SettingsRouter';
import {createMaterialBottomTabNavigator} from 'react-native-paper/react-navigation';
import TrainingRouter from './TrainingRouter';
import {useSelector} from 'react-redux';
import {selectIsAnyTrainingStarted} from '../redux/Training/use/useTrainings';
import useExerciseRecord from '../redux/Effects/useExerciseRecord';
import Toast from 'react-native-toast-message';
import {useSettingsSelector} from '../redux/settings/use/useSettings';
import {useExercise} from '../redux/Exercises/use/useExercise';
import {useNavigation} from '@react-navigation/native';

const Tab = createMaterialBottomTabNavigator();

export const BottomTabs = () => {
  const navigation = useNavigation();
  // GH-671: a boolean and a toggle instead of the training list and the whole settings — both
  // were new values on every logged set and re-rendered the tab navigator each time.
  const disableToasts = useSettingsSelector((settings) => settings.toggles?.disableToasts);
  const isTrainingStarted = useSelector(selectIsAnyTrainingStarted);
  let useExerciseRecord1 = useExerciseRecord();
  let exercise = useExercise(useExerciseRecord1?.exerciseId);

  React.useEffect(() => {
    if (useExerciseRecord1 && exercise && !disableToasts) {
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
  }, [useExerciseRecord1, exercise, navigation, disableToasts]);

  return (
    <Tab.Navigator initialRouteName="Training" shifting={true} backBehavior="history">
      <Tab.Screen
        name="Training"
        component={TrainingRouter}
        options={{
          tabBarIcon: 'book-open-variant',
          tabBarBadge: isTrainingStarted,
          tabBarAccessibilityLabel: 'tab-training',
          tabBarTestID: 'tab-training',
        }}
      />
      <Tab.Screen
        name="Exercises"
        component={ExerciseRouter}
        options={{
          tabBarIcon: 'weight-lifter',
          tabBarAccessibilityLabel: 'tab-exercises',
          tabBarTestID: 'tab-exercises',
        }}
      />
      <Tab.Screen
        name="Analyse"
        component={AnalyseRouter}
        options={{
          tabBarLabel: 'Analysis',
          tabBarIcon: 'trending-up',
          tabBarAccessibilityLabel: 'tab-analyse',
          tabBarTestID: 'tab-analyse',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsRouter}
        options={{
          tabBarIcon: 'cog',
          tabBarAccessibilityLabel: 'tab-settings',
          tabBarTestID: 'tab-settings',
        }}
      />
    </Tab.Navigator>
  );
};
