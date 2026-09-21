import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import DateRangePicker, {Range} from '../picker/date/DateRangePicker';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import {Workout} from '../../models/entities/Workout';
import MetricsOverviewForWorkouts from './MetricsOverviewForWorkouts';
import {Muscles} from '../../models/Muscles';
import {Exercise} from '../../models/entities/Exercise';
import React from 'react';
import {StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import AnalyseEmptyState from './AnalyseEmptyState';
import AnalyseStaleRangeBanner from './AnalyseStaleRangeBanner';
import {ANALYSE_EXTENDED_RANGE_MONTHS, describeRange, rangeEndingToday} from '../../utils/analyse-range';

interface MetricNodeProps {
  range: Range;
  setRange: (range: Range) => void;
  muscle: Muscles[];
  exercise: Exercise[];
}

const MetricsNode = ({range, setRange, muscle, exercise}: MetricNodeProps) => {
  let exercisesForMuscles = useExercisesForMuscles(muscle);
  let exerciseIDs = exercise.map((it) => it.id);
  let exercisesForMusclesIds = exercisesForMuscles.map((it) => it.id);

  function getUniquewRokoutsIn(range: Range) {
    let allWorkouts = useWorkoutsIn(range);
    if (muscle.length === 0 && exercise.length === 0) return allWorkouts;
    let workoutsForExercise = allWorkouts.reverse().filter((workout: Workout) => (exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : false)) as Workout[];
    let workoutsForMuscles = allWorkouts.reverse().filter((workout: Workout) => (exercisesForMusclesIds.length > 0 ? exercisesForMusclesIds.includes(workout.exerciseId) : false)) as Workout[];
    let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
    return Array.from(new Set(combinedWorkouts.map((workout) => workout.id))).map((id) => combinedWorkouts.find((workout) => workout.id === id)!!);
  }

  let uniqueWorkouts = getUniquewRokoutsIn(range);
  let previousUniqueWorkouts = getUniquewRokoutsIn(range.minusRange());

  // GH-458 (H4): the dashboard drill-down preselects a muscle here. Spelling the
  // active filter out gives the user — and an e2e assertion — the actual value
  // the screen is showing, instead of the picker's opaque "1 selected".
  const selectedNames = [...muscle.map(String), ...exercise.map((it) => it.name)];
  const filterLabel = selectedNames.length > 0 ? `Showing: ${selectedNames.join(', ')}` : 'Showing: all exercises';

  return (
    <>
      <Text style={styles.filterLabel} testID="metrics-active-filter">
        {filterLabel}
      </Text>
      <DateRangePicker range={range} setRange={setRange} />
      <AnalyseStaleRangeBanner range={range} isEmpty={uniqueWorkouts.length === 0} onApplyRange={setRange} testID="metrics-stale-range-banner" />
      <MetricsOverviewForWorkouts
        trainingsWorkouts={uniqueWorkouts}
        previousWorkouts={previousUniqueWorkouts}
        comparisonRangeLabel={describeRange(range.minusRange())}
        emptyState={
          <AnalyseEmptyState
            testID="metrics-empty-state"
            title="No sets in this period"
            description={`${selectedNames.length > 0 ? selectedNames.join(', ') : 'Your exercises'} logged no sets between ${describeRange(range)}.`}
            actions={[
              {
                label: `Extend to last ${ANALYSE_EXTENDED_RANGE_MONTHS} months`,
                testID: 'metrics-empty-extend-range',
                onPress: () => setRange(rangeEndingToday(ANALYSE_EXTENDED_RANGE_MONTHS)),
              },
            ]}
          />
        }
      />
    </>
  );
};

const styles = StyleSheet.create({
  filterLabel: {
    marginHorizontal: 12,
    marginTop: 8,
  },
});

export default MetricsNode;
