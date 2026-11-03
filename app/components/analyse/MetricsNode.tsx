import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import DateRangePicker, {Range} from '../picker/date/DateRangePicker';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import {Workout} from '../../models/entities/Workout';
import MetricsOverviewForWorkouts from './MetricsOverviewForWorkouts';
import {Muscles} from '../../models/Muscles';
import {Exercise} from '../../models/entities/Exercise';
import React, {memo} from 'react';
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

  const hasSelection = muscle.length > 0 || exercise.length > 0;
  const selectionExerciseIds = [...new Set([...exerciseIDs, ...exercisesForMusclesIds])].filter((id): id is number => id !== undefined);
  const selectedNames = [...muscle.map(String), ...exercise.map((it) => it.name)];

  return (
    <>
      <DateRangePicker range={range} setRange={setRange} />
      <AnalyseStaleRangeBanner range={range} isEmpty={!uniqueWorkouts.some((workout) => workout.sets.length > 0)} selectionExerciseIds={hasSelection ? selectionExerciseIds : undefined} onApplyRange={setRange} testID="metrics-stale-range-banner" />
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

const rangeTime = (date: Date) => new Date(date).getTime();

// GH-675: RangeSwiper hands every pane a NEW Range object on each swipe, although two of the three panes keep
// their period. Comparing the period by value lets those two skip the render (and their workout scans); only
// the pane that moved to a new week renders. setRange is stable (RangeSwiper), exercise/muscle are state.
const arePropsEqual = (previous: MetricNodeProps, next: MetricNodeProps) =>
  rangeTime(previous.range.startDate) === rangeTime(next.range.startDate) &&
  rangeTime(previous.range.endDate) === rangeTime(next.range.endDate) &&
  previous.setRange === next.setRange &&
  previous.exercise === next.exercise &&
  previous.muscle === next.muscle;

export default memo(MetricsNode, arePropsEqual);
