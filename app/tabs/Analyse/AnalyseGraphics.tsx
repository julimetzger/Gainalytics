import React, {useEffect, useState} from 'react';
import {processColor, ScrollView, StyleSheet} from 'react-native';
import {useTheme, HelperText} from 'react-native-paper';
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

  const validateSelections = () => {
    let errors: string[] = [];
    if (exercise.length === 0 && muscle.length === 0) {
      errors.push('Exercise or Muscle');
    }
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

      {(exercise.length > 0 || muscle.length > 0) && metric && accumulation && (
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
      {selectedWorkout && (exercise.length > 0 || muscle.length > 0) && <WorkoutView workoutIds={selectedWorkoutIds} highlightMode={metric !== Metric.FREQUENCY ? metric : undefined} editable={false}></WorkoutView>}
      <HelperText type="error" visible={!!errorMessage}>
        {errorMessage}
      </HelperText>
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
