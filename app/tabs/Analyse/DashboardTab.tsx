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
import {useLastWorkoutDate, useLastWorkoutDateByMuscle} from '../../redux/Workout/use/useLastWorkoutDate';
import AnalyseStaleRangeBanner from '../../components/analyse/AnalyseStaleRangeBanner';
import {rangeEndingAt} from '../../utils/analyse-range';
import AnalyseEmptyState from '../../components/analyse/AnalyseEmptyState';
import {Metric} from '../../models/Metric';

const DashboardTab = () => {
  const navigation = useNavigation<any>();
  const now = new Date();
  const currentWeekRange = new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now, 0));
  const previousWeekRange = currentWeekRange.minusRange();

  const currentWorkouts = useWorkoutsIn(currentWeekRange);
  // A session with no logged set is not a training this week (GH-458 round 3).
  const hasCurrentWeekSets = useMemo(() => currentWorkouts.some((workout) => workout.sets.length > 0), [currentWorkouts]);
  const previousWorkouts = useWorkoutsIn(previousWeekRange);
  const currentTrainings = useCompletedTrainingsIn(currentWeekRange);
  const previousTrainings = useCompletedTrainingsIn(previousWeekRange);
  const lastWorkoutDate = useLastWorkoutDate();
  const lastWorkoutDateByMuscle = useLastWorkoutDateByMuscle();

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
  // Fall back range for a muscle with no dated history of its own at all: this
  // week when the user trained this week, otherwise the three months up to
  // their last logged workout (any muscle).
  const drilldownRange = useMemo(
    () => (hasCurrentWeekSets || lastWorkoutDate === undefined ? currentWeekRange : rangeEndingAt(lastWorkoutDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasCurrentWeekSets, lastWorkoutDate?.getTime()],
  );

  // GH-458 round 2 (review #2): the range above only asked "did ANY muscle
  // get trained this week" — a chip for a muscle that was skipped this week
  // (while others were trained) still opened on the current week and landed
  // on an empty table for exactly that muscle. Pick the range for the tapped
  // muscle specifically: this week if THIS muscle has sets in it, otherwise
  // the period ending on this muscle's own last workout.
  const handleMusclePress = (muscle: Muscles) => {
    const trainedThisWeek = (muscleMetricMap.get(muscle)?.get(Metric.VOLUME)?.value ?? 0) > 0;
    const lastWorkoutForMuscle = lastWorkoutDateByMuscle.get(muscle);
    const range = trainedThisWeek ? currentWeekRange : lastWorkoutForMuscle !== undefined ? rangeEndingAt(lastWorkoutForMuscle) : drilldownRange;

    navigation.navigate('Metrics', {
      muscle,
      rangeStartMs: range.startDate.getTime(),
      rangeEndMs: range.endDate.getTime(),
      // Same muscle + same range twice in a row must still reset the screen.
      drilldownNonce: Date.now(),
    });
  };

  const handleExercisePress = (exercise: Exercise) => {
    navigation.navigate('History', {exercise, lowerRangeBound: undefined});
  };

  // GH-458 (H3): a brand-new account's Dashboard was pixel-identical to a
  // returning user's — `0 / 0.0t / 0min` with no explanation and no way in.
  // An empty store is a different situation from an empty week and says so.
  if (lastWorkoutDate === undefined) {
    return (
      <ScrollView style={styles.container} testID="dashboard-scroll">
        <AnalyseEmptyState
          testID="dashboard-empty-store"
          title="No training data yet"
          description="Nothing has been logged on this device, so there is nothing to analyse yet. Import an existing history or log your first training."
          actions={[
            {label: 'Import data in Settings', testID: 'dashboard-empty-goto-settings', onPress: () => navigation.navigate('Settings')},
            {label: 'Go to Training', testID: 'dashboard-empty-goto-training', onPress: () => navigation.navigate('Training')},
          ]}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} testID="dashboard-scroll">
      {/* GH-458 (H5): the Dashboard is the entry point of the Analyse area and
          always shows the current week. For a returning user that week is
          empty and, before this, looked exactly like an empty account. The
          banner names the last training date and opens the Metrics Overview on
          a period that holds data. */}
      <AnalyseStaleRangeBanner
        range={currentWeekRange}
        isEmpty={!hasCurrentWeekSets}
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
