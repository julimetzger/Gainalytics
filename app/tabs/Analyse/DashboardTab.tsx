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
import TopExercisesCard from './dashboard/TopExercisesCard';
import FocusExercisesCard from './dashboard/FocusExercisesCard';
import RecordsBadge from './dashboard/RecordsBadge';
import {Exercise} from '../../models/entities/Exercise';
import {useLastWorkoutDate} from '../../redux/Workout/use/useLastWorkoutDate';
import AnalyseStaleRangeBanner from '../../components/analyse/AnalyseStaleRangeBanner';
import {rangeEndingAt} from '../../utils/analyse-range';

const DashboardTab = () => {
  const navigation = useNavigation<any>();
  const now = new Date();
  const currentWeekRange = new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0));
  const previousWeekRange = currentWeekRange.minusRange();

  const currentWorkouts = useWorkoutsIn(currentWeekRange);
  const previousWorkouts = useWorkoutsIn(previousWeekRange);
  const currentTrainings = useCompletedTrainingsIn(currentWeekRange);
  const previousTrainings = useCompletedTrainingsIn(previousWeekRange);
  const lastWorkoutDate = useLastWorkoutDate();

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

  // GH-458 (H4): the chip used to navigate to Metrics with no muscle and no
  // range, so the "details" the label promises were an empty, unfiltered table.
  // Hand over the muscle, plus a range that actually contains sets: this week
  // when the user trained this week, otherwise the three months up to their last
  // logged workout.
  const drilldownRange = useMemo(
    () => (currentWorkouts.length > 0 || lastWorkoutDate === undefined ? currentWeekRange : rangeEndingAt(lastWorkoutDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWorkouts.length, lastWorkoutDate?.getTime()],
  );

  const handleMusclePress = (muscle: Muscles) => {
    navigation.navigate('Metrics', {
      muscle,
      rangeStartMs: drilldownRange.startDate.getTime(),
      rangeEndMs: drilldownRange.endDate.getTime(),
    });
  };

  const handleExercisePress = (exercise: Exercise) => {
    navigation.navigate('History', {exercise, lowerRangeBound: undefined});
  };

  return (
    <ScrollView style={styles.container} testID="dashboard-scroll">
      {/* GH-458 (H5): the Dashboard is the entry point of the Analyse area and
          always shows the current week. For a returning user that week is
          empty and, before this, looked exactly like an empty account. The
          banner names the last training date and opens the Metrics Overview on
          a period that holds data. */}
      <AnalyseStaleRangeBanner
        range={currentWeekRange}
        isEmpty={currentWorkouts.length === 0}
        actionLabel="Show that period"
        onApplyRange={(suggestedRange) =>
          navigation.navigate('Metrics', {
            rangeStartMs: suggestedRange.startDate.getTime(),
            rangeEndMs: suggestedRange.endDate.getTime(),
          })
        }
      />

      <WeeklySummaryCard
        currentTrainings={currentTrainings}
        previousTrainings={previousTrainings}
        currentWorkouts={currentWorkouts}
        previousWorkouts={previousWorkouts}
      />

      <RecordsBadge currentWorkouts={currentWorkouts} exercises={exercises} />

      <MuscleHeatmap muscleMetricMap={muscleMetricMap} onMusclePress={handleMusclePress} />

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
