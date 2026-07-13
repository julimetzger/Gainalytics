import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {firstDayOfWeek, lastDayOfWeek} from '../../utils/DateHelper';
import {Range} from '../../components/picker/date/DateRangePicker';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import {useCompletedTrainingsIn} from '../../redux/Training/use/useCompletedTrainingsIn';
import {useExerciseByIds} from '../../redux/Exercises/use/useExerciseByIds';
import {calculateMetricComparisons, calculateMetricComparisonsForMuscle, WorkoutSetMap} from '../../utils/AnalyseUtils';
import {Muscles} from '../../models/Muscles';
import WeeklySummaryCard from './dashboard/WeeklySummaryCard';
import MuscleHeatmap from './dashboard/MuscleHeatmap';
import WeeklyMuscleMapCard from './dashboard/WeeklyMuscleMapCard';
import TopExercisesCard from './dashboard/TopExercisesCard';
import FocusExercisesCard from './dashboard/FocusExercisesCard';
import RecordsBadge from './dashboard/RecordsBadge';
import {Exercise} from '../../models/entities/Exercise';
import CollapsibleSection from '../../components/analyse/CollapsibleSection';
import MetricsOverviewForWorkouts from '../../components/analyse/MetricsOverviewForWorkouts';

const DashboardTab = () => {
  const navigation = useNavigation<any>();
  const now = new Date();
  const currentWeekRange = new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0));
  const previousWeekRange = currentWeekRange.minusRange();

  const currentWorkouts = useWorkoutsIn(currentWeekRange);
  const previousWorkouts = useWorkoutsIn(previousWeekRange);
  const currentTrainings = useCompletedTrainingsIn(currentWeekRange);
  const previousTrainings = useCompletedTrainingsIn(previousWeekRange);

  const exerciseIds = useMemo(
    () => [...new Set([...currentWorkouts, ...previousWorkouts].map((w) => w.exerciseId))],
    [currentWorkouts, previousWorkouts],
  );
  const exercises = useExerciseByIds(exerciseIds).filter(Boolean) as Exercise[];

  const exerciseWorkoutMap = useMemo(
    () =>
      new Map(
        exercises.map((exercise) => [
          exercise,
          {
            currentWorkoutSets: currentWorkouts.filter((w) => w.exerciseId === exercise.id).flatMap((w) => w.sets),
            lastWorkoutSets: previousWorkouts.filter((w) => w.exerciseId === exercise.id).flatMap((w) => w.sets),
          } satisfies WorkoutSetMap,
        ]),
      ),
    [exercises, currentWorkouts, previousWorkouts],
  );

  const exerciseMetricMap = useMemo(
    () => new Map(Array.from(exerciseWorkoutMap).map(([exercise, workout]) => [exercise, calculateMetricComparisons(workout)])),
    [exerciseWorkoutMap],
  );

  const muscleMetricMap = useMemo(() => calculateMetricComparisonsForMuscle(exerciseWorkoutMap), [exerciseWorkoutMap]);

  const handleMusclePress = (muscle: Muscles) => {
    navigation.navigate('Metrics');
  };

  const handleExercisePress = (exercise: Exercise) => {
    navigation.navigate('History', {exercise, lowerRangeBound: undefined});
  };

  return (
    <ScrollView style={styles.container} testID="dashboard-scroll">
      <WeeklySummaryCard
        currentTrainings={currentTrainings}
        previousTrainings={previousTrainings}
        currentWorkouts={currentWorkouts}
        previousWorkouts={previousWorkouts}
      />

      <RecordsBadge currentWorkouts={currentWorkouts} exercises={exercises} />

      <CollapsibleSection id="muscleGroups" title="Muscle Groups">
        <MuscleHeatmap muscleMetricMap={muscleMetricMap} onMusclePress={handleMusclePress} />
      </CollapsibleSection>

      <CollapsibleSection id="muscleMap" title="Muscle Map">
        <WeeklyMuscleMapCard muscleMetricMap={muscleMetricMap} />
      </CollapsibleSection>

      <CollapsibleSection id="metrics" title="Metriken">
        <MetricsOverviewForWorkouts trainingsWorkouts={currentWorkouts} previousWorkouts={previousWorkouts} />
      </CollapsibleSection>

      <FocusExercisesCard exerciseMetricMap={exerciseMetricMap} onExercisePress={handleExercisePress} />

      <TopExercisesCard exerciseMetricMap={exerciseMetricMap} onExercisePress={handleExercisePress} />

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  quickNav: {
    margin: 8,
    marginBottom: 24,
  },
  quickNavTitle: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  navButton: {
    flex: 1,
    minWidth: 100,
  },
});

export default DashboardTab;
