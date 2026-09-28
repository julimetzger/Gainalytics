import React, {useEffect, useState} from 'react';
import {processColor, ScrollView, StyleSheet} from 'react-native';
import {useTheme} from 'react-native-paper';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from '../../utils/DateHelper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ChartSelectEvent, LineChart, LineValue} from 'react-native-charts-wrapper';
import {calculateMetricValue, calculateMetricValueForMuscles} from '../../utils/AnalyseUtils';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import {sum} from 'lodash';
import TrainingElementPicker, {Accumulation} from '../../components/picker/elements/TrainingElementPicker';
import {useWorkoutsByIds} from '../../redux/Workout/use/useWorkoutsByIds';
import WorkoutView from '../../components/Workout/show/WorkoutDoneList';
import {Muscles} from '../../models/Muscles';
import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import {Exercise} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';
import {handleAccumulationModeBatching} from '../../utils/HandleAccumulationModeBatching';
import {generateTrend} from '../../utils/generateTrend';
import {Metric} from "../../models/Metric";
import {AccumulationMode} from '../../models/AccumulationMode';
import AnalyseEmptyState from '../../components/analyse/AnalyseEmptyState';
import AnalyseStaleRangeBanner from '../../components/analyse/AnalyseStaleRangeBanner';
import {useLastTrainedExerciseId, useLastWorkoutDateForExercises} from '../../redux/Workout/use/useLastWorkoutDate';
import {ANALYSE_EXTENDED_RANGE_MONTHS, describeRange, rangeEndingAt, rangeEndingToday} from '../../utils/analyse-range';
import {getDateStringFromDate} from '../../utils/DateHelper';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';

const AnalyseGraphics = ({}: Props) => {
  function handleDataPointSelect(value: ChartSelectEvent) {
    let ids = value.nativeEvent?.data?.id
      ?.split(',')
      .filter((value: string) => value !== '')
      ?.map((value: string) => parseInt(value));
    setSelectedWorkoutIds(ids ?? []);
  }

  let now = new Date(Date.now());
  const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)));
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<number[]>([]);
  const [metric, setMetric] = useState(Metric.ONE_RM);
  const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.SINGLE_DAY));
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  let exercisesForMuscles = useExercisesForMuscles(muscle);
  let exerciseIDs = exercise.map((it) => it.id);
  let exercisesForMusclesIds = exercisesForMuscles.map((it) => it.id);
  let allWorkouts = useWorkoutsIn(range);
  let workoutsForExercise = allWorkouts.reverse().filter((workout: Workout) => (exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : false)) as Workout[];
  let workoutsForMuscles = allWorkouts.reverse().filter((workout: Workout) => (exercisesForMusclesIds.length > 0 ? exercisesForMusclesIds.includes(workout.exerciseId) : false)) as Workout[];
  const theme = useTheme();
  let selectedWorkout = useWorkoutsByIds(selectedWorkoutIds);

  useEffect(() => {
    setSelectedWorkoutIds([]);
    validateSelections();
  }, [exercise, metric, accumulation, muscle]);

  // GH-458 round 2 (issue #461): "no exercise or muscle chosen yet" is the
  // normal starting state of this screen, not an error — it used to share this
  // same red HelperText with genuine misconfiguration (metric/accumulation
  // cleared), so a first-time visitor saw a red error line over a blank page.
  // That case now gets its own empty state below; this only flags the
  // remaining, real misconfiguration.
  const validateSelections = () => {
    let errors: string[] = [];
    if (!metric) {
      errors.push('Metric');
    }
    if (!accumulation) {
      errors.push('Accumulation Mode');
    }
    setErrorMessage(errors.length > 0 ? `Please select: ${errors.join(', ')}.` : null);
  };

  let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
  let uniqueWorkouts = Array.from(new Set(combinedWorkouts.map((workout) => workout.id))).map((id) => combinedWorkouts.find((workout) => workout.id === id)!!);
  let combinedExercises = [...exercise, ...exercisesForMuscles];
  let uniqueExercises = Array.from(new Set(combinedExercises.map((ex) => ex.id))).map((id) => combinedExercises.find((ex) => ex.id === id)!!);

  // @ts-ignore
  let map = Array.from(uniqueWorkouts.filter((workout: Workout) => workout.sets.length > 0).reduce(handleAccumulationModeBatching(uniqueWorkouts, accumulation), new Map<string, Workout[]>()))
    .map((value) => value as [string, Workout[]])
    .map(([value, workouts]) => {
      let exerciseWorkoutMap = new Map<Exercise, Workout[]>();
      workouts.forEach((workout) => {
        let exercise = uniqueExercises.find((exercise: Exercise) => exercise.id === workout.exerciseId);
        if (workout && exercise) {
          if (exerciseWorkoutMap.get(exercise)) {
            exerciseWorkoutMap.get(exercise)?.push(workout);
          } else {
            exerciseWorkoutMap.set(exercise, [workout]);
          }
        }
      });
      return [value, exerciseWorkoutMap] as [string, Map<Exercise, Workout[]>];
    })
    .flatMap(([value, workouts]) => {
      const allWorkouts = Array.from(workouts.values()).flat() as Workout[];
      let exerciseSetMap = new Map(Array.from(workouts.entries()).map(([exercise, workout]) => [exercise, workout.flatMap((w) => w.sets)]));
      let workoutSetForExercises = exercise.flatMap((ex: Exercise) => {
        return workouts.get(ex)?.flatMap((workout) => workout.sets) ?? [];
      });
      let workoutsCountForExercises = exercise.reduce((total: number, ex: Exercise) => total + (workouts.get(ex)?.length ?? 0), 0);
      let workoutsCountMap = new Map(Array.from(workouts.entries()).map(([ex, ws]) => [ex, ws.length]));
      let muscleSum = sum(muscle.map((mus) => calculateMetricValueForMuscles(exerciseSetMap, metric, mus, workoutsCountMap)));
      let exerciseSum = calculateMetricValue(workoutSetForExercises, metric, workoutsCountForExercises) ?? 0;
      let metricValue;
      if (metric === Metric.ONE_RM || metric === Metric.MAX_INTENSITY || metric === Metric.AVERAGE_INTENSITY) {
        metricValue = Math.max(exerciseSum, muscleSum);
      } else metricValue = exerciseSum + muscleSum;
      return [
        {
          id: allWorkouts.reduce((acc: string, workout: Workout) => acc + ',' + workout.id!!, ''),
          x: new Date(value).getTime(),
          y: exerciseSum + muscleSum,
          marker: metricValue.toFixed(2),
        } as LineValue,
      ];
    })
    .sort((a, b) => a.x!! - b.x!!);

  // GH-458 (H3): the chart used to render an empty outlined rectangle whenever
  // `map` came back empty — no axes, no text. The same blank box stood for
  // "the range holds nothing", "this exercise was never trained" and "something
  // broke", and with no loading indicator anywhere it was not even
  // distinguishable from "still calculating". Below, each of those cases gets
  // its own named cause and at least one action that leads to a result.
  const hasSelection = exercise.length > 0 || muscle.length > 0;
  const isConfigured = hasSelection && !!metric && !!accumulation;
  const selectionLabel = [...exercise.map((it) => it.name), ...muscle.map(String)].join(', ');
  const selectionExerciseIds = uniqueExercises.map((it) => it.id).filter((id): id is number => id !== undefined);
  const lastWorkoutForSelection = useLastWorkoutDateForExercises(selectionExerciseIds);

  // GH-458 round 2 (issue #461): a normal, unconfigured screen used to show
  // only a small red "Please select: Exercise or Muscle." line above an
  // otherwise blank page — it read as an error rather than a starting state.
  // Offer a direct, one-tap suggestion instead: the exercise most recently
  // logged, if there is one.
  const allExercises = useAlleExercises();
  const lastTrainedExerciseId = useLastTrainedExerciseId();
  const suggestedExercise = allExercises.find((it) => it.id === lastTrainedExerciseId);

  const clearSelection = () => {
    setExercise([]);
    setMuscle([]);
  };

  const selectSuggestedExercise = () => {
    if (suggestedExercise) {
      setExercise([suggestedExercise]);
    }
  };

  return (
    <ScrollView
      style={{
        backgroundColor: theme.colors.background,
        display: 'flex',
        flex: 1,
      }}
    >
      <TrainingElementPicker
        exercise={exercise}
        setExercise={setExercise}
        metric={metric}
        setMetric={setMetric}
        accumulation={accumulation}
        setAccumulation={setAccumulation}
        muscle={muscle}
        setMuscle={setMuscle}
      />
      <DateRangePicker range={range} setRange={setRange} />

      <AnalyseStaleRangeBanner range={range} onApplyRange={setRange} testID="analyse-chart-stale-range-banner" />

      {isConfigured && map.length > 0 && (
        <LineChart
          style={{
            backgroundColor: theme.colors.background,
            ...styles.chart,
          }}
          marker={{
            enabled: true,
            markerColor: processColor(theme.colors.backdrop),
            textSize: 15,
            textColor: processColor(theme.colors.secondary),
          }}
          data={{
            dataSets: [
              {
                config: {
                  color: processColor(theme.colors.primary),
                  circleColor: processColor(theme.colors.primary),
                  highlightEnabled: true,
                  lineWidth: 2,
                  drawCircleHole: false,
                  highlightColor: processColor(theme.colors.secondary),
                  circleRadius: 4,
                  mode: 'HORIZONTAL_BEZIER',
                  drawValues: false,
                },
                values: map,
              },
              {
                config: {
                  color: processColor(theme.colors.tertiary),
                  drawCircles: false,
                  lineWidth: 1,
                  dashedLine: {lineLength: 15, spaceLength: 10},
                  mode: 'LINEAR',
                  drawValues: false,
                },
                values: generateTrend(map),
              },
            ],
          }}
          legend={{enabled: false}}
          xAxis={{
            valueFormatter: 'date',
            valueFormatterPattern: 'dd MMM',
            position: 'BOTTOM',
            textColor: processColor(theme.colors.onBackground),
          }}
          yAxis={{
            left: {textColor: processColor(theme.colors.onBackground)},
            right: {textColor: processColor(theme.colors.onBackground)},
          }}
          chartDescription={{text: ''}}
          onSelect={(value) => handleDataPointSelect(value)}
        />
      )}
      {/* GH-458 round 2 (issue #461): a normal, first-time state, not an
          error — this replaces the red "Please select: Exercise or Muscle."
          line the audit flagged, and offers the last-trained exercise as a
          one-tap starting point instead of only pointing back at the picker. */}
      {!isConfigured && !hasSelection && (
        <AnalyseEmptyState
          testID="analyse-chart-no-selection"
          title="Choose what to analyse"
          description={
            suggestedExercise
              ? `Pick an exercise or a muscle group above, or start with ${suggestedExercise.name} — the last thing you trained.`
              : 'Pick an exercise or a muscle group above to see its progress over time.'
          }
          actions={
            suggestedExercise
              ? [{label: `Select ${suggestedExercise.name}`, testID: 'analyse-chart-select-suggested', onPress: selectSuggestedExercise}]
              : []
          }
        />
      )}

      {!isConfigured && hasSelection && (
        <AnalyseEmptyState testID="analyse-chart-misconfigured" title="Nothing to chart yet" description={`${errorMessage} Open the selector above and pick what you want to see.`} />
      )}

      {isConfigured && map.length === 0 && lastWorkoutForSelection === undefined && (
        <AnalyseEmptyState
          testID="analyse-chart-never-trained"
          title={`${selectionLabel} has never been trained`}
          description={`There is not a single logged set for ${selectionLabel}, so there is nothing to chart — no date range will change that.`}
          actions={[{label: 'Choose something else', testID: 'analyse-chart-clear-selection', onPress: clearSelection}]}
        />
      )}

      {isConfigured && map.length === 0 && lastWorkoutForSelection !== undefined && (
        <AnalyseEmptyState
          testID="analyse-chart-empty-range"
          title={`No sets for ${selectionLabel} in this period`}
          description={`${selectionLabel} has no logged sets between ${describeRange(range)}. The last one was on ${getDateStringFromDate(lastWorkoutForSelection)}.`}
          actions={[
            {
              label: `Extend to last ${ANALYSE_EXTENDED_RANGE_MONTHS} months`,
              testID: 'analyse-chart-extend-range',
              onPress: () => setRange(rangeEndingToday(ANALYSE_EXTENDED_RANGE_MONTHS)),
            },
            {
              label: `Jump to ${getDateStringFromDate(lastWorkoutForSelection)}`,
              testID: 'analyse-chart-jump-to-last',
              onPress: () => setRange(rangeEndingAt(lastWorkoutForSelection)),
            },
          ]}
        />
      )}

      {selectedWorkout && isConfigured && <WorkoutView workoutIds={selectedWorkoutIds} highlightMode={metric !== Metric.FREQUENCY ? metric : undefined} editable={false}></WorkoutView>}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  chart: {
    height: 350,
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'AnalyseHome'>;

export default AnalyseGraphics;
