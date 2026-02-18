import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import React, {useState} from 'react';
import {BarChart, BarData, BarValue, ChartSelectEvent} from 'react-native-charts-wrapper';
import TrainingElementPicker, {Accumulation} from '../../components/picker/elements/TrainingElementPicker';
import {processColor, ScrollView, StyleSheet} from 'react-native';
import {Exercise, Record} from '../../models/entities/Exercise';
import {Muscles} from '../../models/Muscles';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from '../../utils/DateHelper';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import {Workout} from '../../models/entities/Workout';
import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import {handleAccumulationModeBatching} from '../../utils/HandleAccumulationModeBatching';
import {Card, Text, useTheme} from 'react-native-paper';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';
import {AccumulationMode} from "../../models/AccumulationMode";

const RecordsTab = () => {
  let now = new Date(Date.now());
  const theme = useTheme();
  let exercises = useAlleExercises();
  const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.WEEK));
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>([]);
  const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)));
  const [selectedRecords, setSelectedRecords] = useState<Map<Exercise, Workout[]>>(new Map());
  let exercisesForMuscles = useExercisesForMuscles(muscle);
  let exerciseIDs = exercise.map((it) => it.id);
  let exercisesForMusclesIds = exercisesForMuscles.map((it) => it.id);
  let allWorkouts = useWorkoutsIn(range).filter((workout: Workout) => workout.records);
  let workoutsForExercise = allWorkouts.reverse().filter((workout: Workout) => (exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : muscle.length <= 0)) as Workout[];
  let workoutsForMuscles = allWorkouts
    .reverse()
    .filter((workout: Workout) => (exercisesForMusclesIds.length > 0 ? exercisesForMusclesIds.includes(workout.exerciseId) : exercise.length <= 0)) as Workout[];
  let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
  let uniqueWorkouts = Array.from(new Set(combinedWorkouts.map((workout) => workout.id))).map((id) => combinedWorkouts.find((workout) => workout.id === id)!!);

  let dateWorkoutMapForRecords = Array.from(
    uniqueWorkouts.filter((workout: Workout) => workout.sets.length > 0).reduce(handleAccumulationModeBatching(uniqueWorkouts, accumulation), new Map<string, Workout[]>()),
  ).map(([value, workout]) => [new Date(value).getTime() / (1000 * 60 * 60 * 24), workout] as [number, Workout[]]);

  let barValues = dateWorkoutMapForRecords
    .map(([value, workouts]) => {
      return {
        x: value,
        y: workouts.length,
        marker: new Date(value).getTime().toString(),
      } as BarValue;
    })
    .reverse();

  function handleDataPointSelect(value: ChartSelectEvent) {
    let xValue = value.nativeEvent?.data?.x ?? value.nativeEvent?.x;
    if (xValue) {
      let find = dateWorkoutMapForRecords.find(([date, _]) => xValue === date);
      let map = new Map<Exercise, Workout[]>();
      find?.[1].forEach((workout) => {
        let exercise = exercises.find((exercise) => exercise.id === workout.exerciseId);
        if (exercise) {
          if (map.get(exercise)) {
            map.get(exercise)?.push(workout);
          } else {
            map.set(exercise, [workout]);
          }
        }
      });
      setSelectedRecords(map);
    }
  }

  return (
    <ScrollView
      style={{
        backgroundColor: theme.colors.background,
        display: 'flex',
        flex: 1,
      }}
    >
      <TrainingElementPicker exercise={exercise} setExercise={setExercise} accumulation={accumulation} setAccumulation={setAccumulation} muscle={muscle} setMuscle={setMuscle} />
      <DateRangePicker range={range} setRange={setRange} />
      <BarChart
        drawGridBackground={false}
        data={
          {
            dataSets: [
              {
                label: 'Workouts',
                config: {
                  visible: true,
                  highlightEnabled: true,
                  color: processColor(theme.colors.primary),
                  barShadowColor: processColor(theme.colors.primary),
                  valueTextColor: processColor(theme.colors.primary),
                  highlightColor: processColor(theme.colors.primary),
                },
                values: barValues,
              },
            ],
            config: {
              barWidth: 1,
            },
          } as BarData
        }
        drawValueAboveBar={true}
        borderColor={processColor(theme.colors.primary)}
        style={{
          ...styles.chart,
        }}
        xAxis={{
          timeUnit: 'DAYS',
          valueFormatter: 'date',
          valueFormatterPattern: 'dd MMM',
          position: 'BOTTOM',
          textColor: processColor(theme.colors.onBackground),
        }}
        yAxis={{
          left: {textColor: processColor(theme.colors.onBackground)},
          right: {textColor: processColor(theme.colors.onBackground)},
        }}
        legend={{enabled: false}}
        chartDescription={{text: ''}}
        onSelect={(value) => handleDataPointSelect(value)}
      />
      {selectedRecords ? (
        Array.from(selectedRecords).map(([exercise, workouts]) => {
          return (
            <Card style={{marginBottom: 5}} key={exercise.id}>
              <Card.Title title={exercise.name} />
              <Card.Content>
                {workouts.map((workout) => (
                  <Text key={workout?.id}>
                    {workout?.start ? new Date(workout.start).toDateString() : null} {workout?.records?.[Record.ONE_RM]?.toFixed(2)} kg
                  </Text>
                ))}
              </Card.Content>
            </Card>
          );
        })
      ) : (
        <></>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  chart: {
    height: 350,
  },
});

export default RecordsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Records'>;
