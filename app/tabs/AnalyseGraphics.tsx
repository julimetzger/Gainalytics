import React, {useEffect, useState} from 'react';
import {processColor, ScrollView, StyleSheet, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../components/DateRangePicker";
import {firstDayOfWeek, getEndOfDay} from "../utils/DateHelper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {ChartSelectEvent, LineChart, LineValue} from 'react-native-charts-wrapper';
import {calculateMetricValue} from "../utils/RepetitionMaxHelper";
import {RootStackParamList} from "../routing/AnalyseRouter";
import {sumBy} from "lodash";
import Picker, {AccumulationMode, Accumulation, Metric} from "../components/Picker";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import WorkoutView from "../components/WorkoutView";
import {getAllTrainingsForMicro, getMicroFromTrainingInMicroIndex} from "../redux/Training/trainingsPlanReducer";

const AnalyseGraphics = ({}: Props) => {
    function handleDataPointSelect(value: ChartSelectEvent) {
        let ids = value.nativeEvent?.data?.id?.split(",").filter((value: string) => value !== "")?.map((value: string) => parseInt(value))
        setSelectedWorkoutIds(ids ?? []);
    }

    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(firstDayOfWeek(now, 1), getEndOfDay(now)))
    const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<number[]>([]);
    const [metric, setMetric] = useState(Metric.ONE_RM);
    const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.SINGLE_DAY))
    const [exercise, setExercise] = useState<Exercise[]>([]);
    let exerciseIDs = exercise.map(it => it.id);
    let allWorkouts = useWorkoutsIn(range);
    let workoutsForExercise = allWorkouts.reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true) as Workout[];
    const theme = useTheme();
    let selectedWorkout = useWorkoutsByIds(selectedWorkoutIds);
    useEffect(() => {
        setSelectedWorkoutIds([]);
    }, [exercise, metric, accumulation]);

// @ts-ignore
    let map = Array.from(workoutsForExercise
        .filter((workout: Workout) => workout.sets.length > 0)
        .reduce(handleAccumulationModeBatching(workoutsForExercise, accumulation), new Map<string, Workout[]>()))
        .flatMap(([value, workouts]) => [{
            id: workouts.reduce((acc: string, workout: Workout) => acc + "," + workout.id!!, ""),
            x: new Date(value).getTime(),
            y: calculateMetricValue(workouts.flatMap(workout => workout.sets), metric),
            marker: calculateMetricValue(workouts.flatMap(workout => workout.sets), metric)?.toFixed(2)
        } as LineValue])
        .sort(((a, b) => a.x!! - b.x!!));
    return (
        <View style={{
            backgroundColor: theme.colors.background,
            display: 'flex',
            flex: 1,
            justifyContent: 'flex-start',
        }}>
            <ScrollView keyboardShouldPersistTaps={'always'}>
                <DateRangePicker range={range} setRange={setRange}/>
                <Picker exercise={exercise} setExercise={setExercise}
                        metric={metric} setMetric={setMetric}
                        accumulation={accumulation} setAccumulation={setAccumulation}
                        muscles={true}/>
            </ScrollView>
            {exercise.length > 0 && metric && accumulation && <LineChart
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
                onSelect={(value) => handleDataPointSelect(value)}/>}

            <ScrollView>
                {selectedWorkout && exercise.length > 0 &&
                    <WorkoutView workoutIds={selectedWorkoutIds} highlightMode={metric} editable={false}></WorkoutView>}
            </ScrollView>
        </View>
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
                acc.set(new Date(workout.start!!).toISOString(), [workout]);
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

