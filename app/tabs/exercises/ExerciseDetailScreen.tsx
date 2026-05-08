import React, {useEffect, useLayoutEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import {Icon, IconButton, Text, useTheme} from 'react-native-paper';
import {useExercise} from '../../redux/Exercises/use/useExercise';
import {dispatchEditExercise} from '../../redux/Exercises/dispatch/dispatchEditExercise';
import ExerciseLogTab from '../../components/exercise/show/ExerciseLogTab';
import ExerciseStatsTab from '../../components/exercise/show/ExerciseStatsTab';
import ExerciseHistoryTabContent from '../../components/exercise/show/ExerciseHistoryTabContent';
import ExerciseGraphTab from '../../components/exercise/show/ExerciseGraphTab';

type TabKey = 'log' | 'stats' | 'history' | 'graph';

const TABS: {key: TabKey; label: string; icon: string}[] = [
  {key: 'log', label: 'Log', icon: 'plus-circle-outline'},
  {key: 'stats', label: 'Stats', icon: 'view-list-outline'},
  {key: 'history', label: 'History', icon: 'history'},
  {key: 'graph', label: 'Graph', icon: 'chart-line'},
];

const ExerciseDetailScreen = ({navigation, route}: Props) => {
  const theme = useTheme();
  const exerciseFromParam = route.params.exercise;
  const live = useExercise(exerciseFromParam.id);
  const exercise = live ?? exerciseFromParam;

  const [activeTab, setActiveTab] = useState<TabKey>('log');
  const editExercise = dispatchEditExercise();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: exercise.name,
      headerRight: () => (
        <View style={styles.headerRight}>
          <IconButton
            icon={exercise.isFocus ? 'star' : 'star-outline'}
            iconColor={exercise.isFocus ? '#FFB300' : undefined}
            size={22}
            testID="exercise-detail-focus-toggle"
            onPress={() => {
              if (!exercise.id) return;
              editExercise(exercise.id, exercise.name, exercise.muscles ?? [], exercise.alternativeIds ?? [], !exercise.isFocus);
            }}
          />
          <IconButton
            icon="pencil-outline"
            size={22}
            testID="exercise-detail-edit-button"
            onPress={() => navigation.navigate({name: 'EditExerciseSheet', params: {exerciseId: exercise.id}})}
          />
        </View>
      ),
    });
  }, [navigation, exercise.name, exercise.isFocus, exercise.id, exercise.muscles, exercise.alternativeIds]);

  useEffect(() => {
    if (route.params.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params.initialTab]);

  return (
    <View style={[styles.root, {backgroundColor: theme.colors.background}]}>
      <View style={[styles.tabBar, {backgroundColor: theme.colors.surfaceVariant}]} testID="exercise-detail-tabbar">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tabButton,
                isActive && {backgroundColor: theme.colors.primary},
              ]}
              testID={`exercise-tab-${tab.key}`}
            >
              <Icon
                source={tab.icon}
                size={18}
                color={isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant},
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {activeTab === 'log' && <ExerciseLogTab exercise={exercise} />}
        {activeTab === 'stats' && <ExerciseStatsTab exercise={exercise} />}
        {activeTab === 'history' && <ExerciseHistoryTabContent exercise={exercise} />}
        {activeTab === 'graph' && <ExerciseGraphTab exercise={exercise} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    margin: 8,
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 4,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default ExerciseDetailScreen;
