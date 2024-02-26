import React, {useEffect, useState} from 'react';
import {processColor, ScrollView, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../components/DateRangePicker";
import {firstDayOfWeek, getDateStringFromDate, getEndOfDay} from "../utils/DateHelper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {ChartSelectEvent, LineChart, LineValue} from 'react-native-charts-wrapper';
import {calculateMetricValue, repetitionMax} from "../utils/RepetitionMaxHelper";
import WorkoutSetView from "../components/WorkoutSetView";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {RootStackParamList} from "../routing/AnalyseRouter";
import {sumBy} from "lodash";
import Picker, {AccumaulationMode, Metric} from "../components/Picker";


const AnalyseGraphics = ({route}: Props) => {
    function handleDataPointSelect(value: ChartSelectEvent) {
        value.nativeEvent?.data?.id ? setSelectedWorkoutId(value.nativeEvent?.data.id) : null;
    }


    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(firstDayOfWeek(now, 1), getEndOfDay(now)))
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<number>();
    const [metric, setMetric] = useState(Metric.ONE_RM);
    const [accumulationMode, setAccumulationMode] = useState(AccumaulationMode.SINGLE_DAY)
    const [exercise, setExercise] = useState<Exercise[]>([]);
    let exerciseIDs = exercise.map(it => it.id);
    let lastWorkouts = useWorkoutsIn(range).reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true) as Workout[];
    const theme = useTheme();
    let selectedWorkout = useWorkoutById(selectedWorkoutId);


    useEffect(() => {
        if (exercise === undefined || exercise.length === 0 || metric === undefined || accumulationMode === undefined) {
            setSelectedWorkoutId(undefined);
        }

    }, [exercise, metric, accumulationMode]);

// @ts-ignore
    let map = lastWorkouts
        .filter((workout: Workout) => workout.sets.length > 0)
        .flatMap(value => [{
            id: value.id,
            x: value.start ? new Date(value.start).getTime() : undefined,
            y: calculateMetricValue(value.sets, metric),
            marker: calculateMetricValue(value.sets, metric)?.toFixed(2)
        } as LineValue])
        .sort(((a, b) => a.x!! - b.x!!));
    return (
        <View style={{
            backgroundColor: theme.colors.background,
            display: 'flex',
            justifyContent: 'flex-start',
        }}>
            <ScrollView style={styles.picker}>
                <DateRangePicker range={range} setRange={setRange}/>
                <Picker exercise={exercise} setExercise={setExercise} style={styles.exercisePicker}
                        metric={metric} setMetric={setMetric}
                        accumaltionMode={accumulationMode} setAccumaltionMode={setAccumulationMode}/>
            </ScrollView>
            {exercise.length > 0 && metric && accumulationMode && <LineChart
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

            <ScrollView style={styles.exercise}>
                {selectedWorkout && exercise.length > 0 && <>< Text
                    style={{fontSize: 20}}>{getDateStringFromDate(selectedWorkout.end).toString()}</Text>
                    <WorkoutSetView sets={selectedWorkout?.sets ?? []} editable={false}
                                    highLightMode={metric}></WorkoutSetView>
                </>}
            </ScrollView>
        </View>
    )
};


let styles = StyleSheet.create({
    chart: {
        height: '50%',
        width: '100%'
    },
    picker: {
        height: '25%',
    },
    exercise: {
        height: '25%',
    },
    exercisePicker: {
        marginBottom: 20,
    }

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
