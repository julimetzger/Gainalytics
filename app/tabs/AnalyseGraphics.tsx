import React, {useEffect, useState} from 'react';
import {processColor, ScrollView, StyleSheet} from 'react-native';
import {useTheme} from 'react-native-paper';
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../components/DateRangePicker";
import {firstDayOfWeek, getEndOfDay, lastDayOfWeek, subtractMonths} from "../utils/DateHelper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {ChartSelectEvent, LineChart, LineValue} from 'react-native-charts-wrapper';
import {calculateMetricValue, calculateMetricValueForMuscles} from "../utils/RepetitionMaxHelper";
import {RootStackParamList} from "../routing/AnalyseRouter";
import {sum, sumBy} from "lodash";
import Picker, {AccumulationMode, Accumulation, Metric} from "../components/Picker";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import WorkoutView from "../components/WorkoutView";
import {getAllTrainingsForMicro, getMicroFromTrainingInMicroIndex} from "../redux/Training/trainingsPlanReducer";
import {Muscles} from "../models/Muscles";
import {useExercisesForMuscles} from "../redux/Exercises/useExercisesForMuscles";
import {Exercise} from "../models/Exercise";
import {Workout} from "../models/Workout";

const AnalyseGraphics = ({}: Props) => {
    function handleDataPointSelect(value: ChartSelectEvent) {
        let ids = value.nativeEvent?.data?.id?.split(",").filter((value: string) => value !== "")?.map((value: string) => parseInt(value))
        setSelectedWorkoutIds(ids ?? []);
    }

    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)))
    const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<number[]>([]);
    const [metric, setMetric] = useState(Metric.ONE_RM);
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
    let selectedWorkout = useWorkoutsByIds(selectedWorkoutIds);
    useEffect(() => {
        setSelectedWorkoutIds([]);
    }, [exercise, metric, accumulation, muscle]);
    let combinedWorkouts = [...workoutsForExercise, ...workoutsForMuscles];
    let uniqueWorkouts = Array.from(new Set(combinedWorkouts.map(workout => workout.id)))
        .map(id => combinedWorkouts.find(workout => workout.id === id)!!);
    let combinedExercises = [...exercise, ...exercisesForMuscles];
    let uniqueExercises = Array.from(new Set(combinedExercises.map(ex => ex.id)))
        .map(id => combinedExercises.find(ex => ex.id === id)!!);

// @ts-ignore
    let map = Array.from(uniqueWorkouts
        .filter((workout: Workout) => workout.sets.length > 0)
        .reduce(handleAccumulationModeBatching(uniqueWorkouts, accumulation), new Map<string, Workout[]>()))
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
            return [{
                id: allWorkouts.reduce((acc: string, workout: Workout) => acc + "," + workout.id!!, ""),
                x: new Date(value).getTime(),
                y: exerciseSum + muscleSum,
                marker: (exerciseSum + muscleSum).toFixed(2)
            } as LineValue]
        })
        .sort(((a, b) => a.x!! - b.x!!));
    return (
        <ScrollView style={{
            backgroundColor: theme.colors.background,
            display: 'flex',
            flex: 1,
        }}>
            <Picker exercise={exercise} setExercise={setExercise}
                    metric={metric} setMetric={setMetric}
                    accumulation={accumulation} setAccumulation={setAccumulation}
                    muscle={muscle} setMuscle={setMuscle}/>
            <DateRangePicker range={range} setRange={setRange}/>

            {(exercise.length > 0 || muscle.length > 0) && metric && accumulation &&
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
                            }, values: map
                        }, {
                            config: {
                                color: processColor(theme.colors.tertiary),
                                drawCircles: false,
                                lineWidth: 1,
                                dashedLine: {lineLength: 15, spaceLength: 10},
                                mode: 'LINEAR',
                                drawValues: false,
                            }, values: generateTrend(map)
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
                    onSelect={(value) => handleDataPointSelect(value)}
                />}
            {selectedWorkout && (exercise.length > 0 || muscle.length > 0) &&
                <WorkoutView workoutIds={selectedWorkoutIds} highlightMode={metric} editable={false}></WorkoutView>}
        </ScrollView>
    )
};

const styles = StyleSheet.create({
    chart: {
        height: 350
    },
})

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

export type Props = NativeStackScreenProps<RootStackParamList, 'Analyse'>;

export default AnalyseGraphics;

const handleAccumulationModeBatching = (allWorkouts: Workout[], accumulationMode?: Accumulation) => {
    return (acc: Map<string, Workout[]>, workout: Workout): Map<string, Workout[]> => {
        switch (accumulationMode?.getAccumulationMode()) {
            case AccumulationMode.SINGLE_DAY: {
                let dateDayStart = new Date(new Date(workout.start!!).setHours(0, 0, 0, 0));
                if (acc.get(dateDayStart.toISOString())) {
                    acc.get(dateDayStart.toISOString())!!.push(workout);
                } else {
                    acc.set(dateDayStart.toISOString(), [workout]);
                }
                return acc;
            }
            case AccumulationMode.WEEK: {
                let start = new Date(firstDayOfWeek(workout.start!!, 1));
                if (acc.get(start.toISOString())) {
                    acc.get(start.toISOString())!!.push(workout);
                } else {
                    acc.set(start.toISOString(), [workout]);
                }
                return acc;
            }
            case AccumulationMode.TRAINING_MICROCYCLE: {
                let trainingsPlan = accumulationMode?.trainingsPlan;
                if (trainingsPlan) {
                    let trainings = trainingsPlan.trainings;
                    if (workout.trainingsId && Object.values(trainings).includes(workout.trainingsId)) {
                        Object.entries(trainings).forEach(([key, value]) => {
                                if (workout.trainingsId === value) {
                                    let micro = getMicroFromTrainingInMicroIndex(key);
                                    let allTrainingsForMicro = getAllTrainingsForMicro(trainings, micro);
                                    let dates = allWorkouts.filter((workout: Workout) => allTrainingsForMicro.includes(workout.trainingsId!!))
                                        .map((workout: Workout) => workout.start!!)
                                        .sort()
                                    if (dates.length > 0) {
                                        let start = new Date(dates[0]);
                                        if (acc.get(start.toISOString())) {
                                            acc.get(start.toISOString())!!.push(workout);
                                        } else {
                                            acc.set(start.toISOString(), [workout]);
                                        }
                                    }
                                }
                            }
                        )
                    }
                }
                return acc;
            }
        }
        return acc;
    }
}

