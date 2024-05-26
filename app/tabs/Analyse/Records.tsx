import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import React, {useState} from "react";
import {BarChart, BarData, BarValue} from "react-native-charts-wrapper";
import Picker, {Accumulation, AccumulationMode} from "../../components/Picker";
import {processColor, ScrollView, StyleSheet, View} from "react-native";
import {Exercise} from "../../models/Exercise";
import {Muscles} from "../../models/Muscles";
import DateRangePicker, {Range} from "../../components/DateRangePicker";
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from "../../utils/DateHelper";
import {useWorkoutsIn} from "../../redux/Workout/useWorkoutsIn";
import {Workout} from "../../models/Workout";
import {useExercisesForMuscles} from "../../redux/Exercises/useExercisesForMuscles";
import {handleAccumulationModeBatching} from "./HandleAccumulationModeBatching";
import {useTheme} from "react-native-paper";

const RecordsTab = () => {
    let now = new Date(Date.now());
    const theme = useTheme();
    const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.SINGLE_DAY))
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [muscle, setMuscle] = useState<Muscles[]>([]);
    const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)))
    let exercisesForMuscles = useExercisesForMuscles(muscle);
    let exerciseIDs = exercise.map(it => it.id);
    let exercisesForMusclesIds = exercisesForMuscles.map(it => it.id);
    let allWorkouts = useWorkoutsIn(range).filter((workout: Workout) => workout.records);
    let workoutsForExercise = allWorkouts.reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : muscle.length <= 0) as Workout[];
    let workoutsForMuscles = allWorkouts.reverse().filter((workout: Workout) => exercisesForMusclesIds.length > 0 ? exercisesForMusclesIds.includes(workout.exerciseId) : exercise.length <= 0) as Workout[];
    let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
    let uniqueWorkouts = Array.from(new Set(combinedWorkouts.map(workout => workout.id)))
        .map(id => combinedWorkouts.find(workout => workout.id === id)!!);

    let dateWorkoutMapForRecords = Array.from(uniqueWorkouts
        .filter((workout: Workout) => workout.sets.length > 0)
        .reduce(handleAccumulationModeBatching(uniqueWorkouts, accumulation), new Map<string, Workout[]>()))
        .map((value) => value as [string, Workout[]])
    console.log(dateWorkoutMapForRecords);


    let barValues = dateWorkoutMapForRecords.map(([value, workouts]) => {
        return {x: new Date(value).getTime(), y: workouts.length} as BarValue
    });

    console.log(barValues);

    return (
        <ScrollView style={{
            backgroundColor: theme.colors.background,
            display: 'flex',
            flex: 1,
        }}>
            <Picker exercise={exercise} setExercise={setExercise}
                    accumulation={accumulation} setAccumulation={setAccumulation}
                    muscle={muscle} setMuscle={setMuscle}/>
            <DateRangePicker range={range} setRange={setRange}/>
            <BarChart data={{
                dataSets: [{
                    config: {
                        color: processColor(theme.colors.primary),
                        highlightEnabled: true,
                        highlightColor: processColor(theme.colors.secondary),
                    },
                    values: barValues
                }]
            } as BarData}
                      style={{
                          backgroundColor: theme.colors.background,
                          ...styles.chart
                      }}
                      xAxis={{
                          valueFormatter: 'date',
                          valueFormatterPattern: 'dd MMM',
                          position: 'BOTTOM_INSIDE',
                          textColor: processColor(theme.colors.onBackground)
                      }}
                      yAxis={{
                          left: {textColor: processColor(theme.colors.onBackground)},
                          right: {textColor: processColor(theme.colors.onBackground)}
                      }}
            />
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    chart: {
        height: 350
    },
})

export default RecordsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Records'>;
