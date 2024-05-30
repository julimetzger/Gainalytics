import React, {useEffect, useState} from 'react';
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import {processColor, ScrollView, StyleSheet, View} from "react-native";
import {LineChart, LineValue} from "react-native-charts-wrapper";
import DateRangePicker, {Range} from "../../components/DateRangePicker";
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from "../../utils/DateHelper";
import Picker, {Accumulation, AccumulationMode, Metric} from "../../components/Picker";
import {Exercise} from "../../models/Exercise";
import {Muscles} from "../../models/Muscles";
import {useExercisesForMuscles} from "../../redux/Exercises/useExercisesForMuscles";
import {useWorkoutsIn} from "../../redux/Workout/useWorkoutsIn";
import {Workout} from "../../models/Workout";
import {Card, useTheme} from "react-native-paper";
import {handleAccumulationModeBatching} from "./HandleAccumulationModeBatching";
import {sum, sumBy} from "lodash";
import {calculateMetricValue, calculateMetricValueForMuscles} from "../../utils/RepetitionMaxHelper";

const GraphsTab = () => {
    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)))
    const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.SINGLE_DAY))
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [muscle, setMuscle] = useState<Muscles[]>([]);
    let exercisesForMuscles = useExercisesForMuscles(muscle);
    let exerciseIDs = exercise.map(it => it.id);
    let exercisesForMusclesIds = exercisesForMuscles.map(it => it.id);
    let allWorkouts = useWorkoutsIn(range);
    let workoutsForExercise = allWorkouts.reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : false) as Workout[];
    let workoutsForMuscles = allWorkouts.reverse().filter((workout: Workout) => exercisesForMusclesIds.length > 0 ? exercisesForMusclesIds.includes(workout.exerciseId) : false) as Workout[];
    const theme = useTheme();
    let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
    let uniqueWorkouts = Array.from(new Set(combinedWorkouts.map(workout => workout.id)))
        .map(id => combinedWorkouts.find(workout => workout.id === id)!!);
    let combinedExercises = [...exercise, ...exercisesForMuscles];
    let uniqueExercises = Array.from(new Set(combinedExercises.map(ex => ex.id)))
        .map(id => combinedExercises.find(ex => ex.id === id)!!);

// @ts-ignore
    let map = Object.values(Metric).map((metric: Metric) => {
        return {
            metric: metric, lineChart: Array.from(uniqueWorkouts
                .filter((workout: Workout) => workout.sets.length > 0)
                .reduce(handleAccumulationModeBatching(uniqueWorkouts, accumulation), new Map<string, Workout[]>()))
                .map((value) => value as [string, Workout[]])
                .map(([value, workouts]) => {
                    let exerciseWorkoutMap = new Map<Exercise, Workout[]>();
                    workouts.forEach(workout => {
                        let exercise = uniqueExercises.find((exercise: Exercise) => exercise.id === workout.exerciseId);
                        if (workout && exercise) {
                            if (exerciseWorkoutMap.get(exercise)) {
                                exerciseWorkoutMap.get(exercise)?.push(workout);
                            } else {
                                exerciseWorkoutMap.set(exercise, [workout]);
                            }
                        }
                    })
                    return [value, exerciseWorkoutMap] as [string, Map<Exercise, Workout[]>]
                })
                .flatMap(([value, workouts]) => {
                    const allWorkouts = Array.from(workouts.values()).flat() as Workout[];
                    let exerciseSetMap = new Map(Array.from(workouts.entries()).map(([exercise, workout]) => [exercise, workout.flatMap(w => w.sets)]));
                    let workoutSetForExercises = exercise.flatMap((ex: Exercise) => {
                        return workouts.get(ex)?.flatMap(workout => workout.sets) ?? [];
                    })
                    let muscleSum = sum(muscle.map(mus => calculateMetricValueForMuscles(exerciseSetMap, metric, mus)));
                    let exerciseSum = calculateMetricValue(workoutSetForExercises, metric) ?? 0;
                    let metricValue
                    if (metric === Metric.ONE_RM || metric === Metric.MAX_INTENSITY || metric === Metric.AVERAGE_INTENSITY) {
                        metricValue = Math.max(exerciseSum, muscleSum)
                    } else
                        metricValue = exerciseSum + muscleSum
                    return [{
                        id: allWorkouts.reduce((acc: string, workout: Workout) => acc + "," + workout.id!!, ""),
                        x: new Date(value).getTime(),
                        y: exerciseSum + muscleSum,
                        marker: metricValue.toFixed(2)
                    } as LineValue]
                })
                .sort(((a, b) => a.x!! - b.x!!))
        }
    });

    return (
        <ScrollView style={{
            backgroundColor: theme.colors.background,
            display: 'flex',
            flex: 1,
        }}>
            <Picker exercise={exercise} setExercise={setExercise}
                    accumulation={accumulation} setAccumulation={setAccumulation}
                    muscle={muscle} setMuscle={setMuscle}
            dropdownLabel={"Select Exercise and Accumulation Mode"}
            />
            <DateRangePicker range={range} setRange={setRange}/>

            {(exercise.length > 0 || muscle.length > 0) && accumulation && map.map((value) =>
                <View>
                    <Card style={{marginBottom: 10}}>
                        <Card.Title title={value.metric}/>
                        <Card.Content>
                            <LineChart
                                style={{
                                    backgroundColor: theme.colors.background,
                                    ...styles.chart
                                }}
                                marker={{
                                    enabled: true,
                                    markerColor: processColor(theme.colors.backdrop),
                                    textSize: 15,
                                    textColor: processColor(theme.colors.secondary)
                                }}
                                data={{
                                    dataSets: [{
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
                                        }, values: value.lineChart
                                    }, {
                                        config: {
                                            color: processColor(theme.colors.tertiary),
                                            drawCircles: false,
                                            lineWidth: 1,
                                            dashedLine: {lineLength: 15, spaceLength: 10},
                                            mode: 'LINEAR',
                                            drawValues: false,
                                        }, values: generateTrend(value.lineChart)
                                    }
                                    ]
                                }}
                                legend={{enabled: false}}
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
                                chartDescription={{text: ''}}
                            /></Card.Content>
                    </Card>
                </View>
            )
            }
        </ScrollView>
    )
};

function generateTrend(map: LineValue[]): LineValue[] {
    if (map.length > 2) {
        let n = map.length;
        let a = (n * sumBy(map, value => value.x!! * value.y) - sumBy(map, value => value.x!!) * sumBy(map, value => value.y)) / (n * sumBy(map, value => value.x!! * value.x!!) - sumBy(map, value => value.x!!) ** 2)
        let b = (sumBy(map, value => value.y) - a * sumBy(map, value => value.x!!)) / n;
        let firstPointy = a * map[0].x!! + b
        let firstPoint = {x: map[0].x!!, y: firstPointy}
        let secondPointy = a * map[n - 1].x!! + b
        let secondPoint = {x: map[n - 1].x!!, y: secondPointy}
        return [firstPoint, secondPoint];
    }
    return [];
}

const styles = StyleSheet.create({
    chart: {
        height: 250
    },
})

export default GraphsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Graphs'>;
