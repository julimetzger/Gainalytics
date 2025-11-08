import React, {useEffect, useState} from 'react';
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import {processColor, ScrollView, StyleSheet, View} from "react-native";
import {LineChart, LineValue} from "react-native-charts-wrapper";
import DateRangePicker, {Range} from "../../components/picker/date/DateRangePicker";
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from "../../utils/DateHelper";
import TrainingElementPicker, {Accumulation, AccumulationMode, Metric} from "../../components/picker/elements/TrainingElementPicker";
import {Exercise} from "../../models/Exercise";
import {Muscles} from "../../models/Muscles";
import {useExercisesForMuscles} from "../../redux/Exercises/use/useExercisesForMuscles";
import {useWorkoutsIn} from "../../redux/Workout/use/useWorkoutsIn";
import {Workout} from "../../models/Workout";
import {Card, useTheme, HelperText} from "react-native-paper";
import {handleAccumulationModeBatching} from "../../utils/HandleAccumulationModeBatching";
import {sum} from "lodash";
import {calculateMetricValue, calculateMetricValueForMuscles} from "../../utils/AnalyseUtils";
import {generateTrend} from "../../utils/generateTrend";

const GraphsTab = () => {
    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)))
    const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.SINGLE_DAY))
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [muscle, setMuscle] = useState<Muscles[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        validateSelections();
    }, [exercise, accumulation, muscle]);

    const validateSelections = () => {
        let errors: string[] = [];
        if (exercise.length === 0 && muscle.length === 0) {
            errors.push("Exercise or Muscle");
        }
        if (!accumulation) {
            errors.push("Accumulation Mode");
        }
        setErrorMessage(errors.length > 0 ? `Please select: ${errors.join(", ")}.` : null);
    };

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
            <TrainingElementPicker exercise={exercise} setExercise={setExercise}
                                   accumulation={accumulation} setAccumulation={setAccumulation}
                                   muscle={muscle} setMuscle={setMuscle}
                                   dropdownLabel={"Select Exercise and Accumulation Mode"}
            />
            <DateRangePicker range={range} setRange={setRange}/>

            {errorMessage && (
                <HelperText type="error" visible={!!errorMessage}>
                    {errorMessage}
                </HelperText>
            )}

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
                                    position: 'BOTTOM',
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

const styles = StyleSheet.create({
    chart: {
        height: 250
    },
})

export default GraphsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Graphs'>;
