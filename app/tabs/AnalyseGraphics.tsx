import React, {useEffect, useState} from 'react';
import {View, StyleSheet, ScrollView, processColor} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../tabs/DateRangePicker";
import {firstDayOfWeek, getDateStringFromDate, getEndOfDay} from "../utils/DateHelper";
import ExercisePicker from "../tabs/ExercisePicker";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {ChartSelectEvent, LineChart, LineValue} from 'react-native-charts-wrapper';
import {repetitionMax} from "../utils/RepetitionMaxHelper";
import WorkoutSetView from "./WorkoutSetView";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {RootStackParamList} from "../routing/AnalyseRouter";


const AnalyseGraphics = ({route}: Props) => {
    function handleDataPoíntSelcet(value: ChartSelectEvent) {
        value.nativeEvent?.data?.id ? setSelectedWorkoutId(value.nativeEvent?.data.id) : null;
    }


    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(firstDayOfWeek(now, 1), getEndOfDay(now)))
    const [selectedWorkoutId, setSelectedWorkoutId] = useState<number>();
    const [exercise, setExercise] = useState<Exercise[]>([]);
    let exerciseIDs = exercise.map(it => it.id);
    let lastWorkouts = useWorkoutsIn(range).reverse().filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true) as Workout[];
    const theme = useTheme();
    let selectedWorkout = useWorkoutById(selectedWorkoutId);
    // @ts-ignore
    let map = lastWorkouts
        .flatMap(value => [{
            id: value.id,
            x: value.start ? new Date(value.start).getTime() : undefined,
            y: repetitionMax(...value.sets)?.valueOf(),
            marker: repetitionMax(...value.sets)?.valueOf().toFixed(2)
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
                <ExercisePicker exercise={exercise} setExercise={setExercise} style={styles.exercisePicker}/>
            </ScrollView>
            {exercise.length > 0 && <LineChart
                style={{
                    backgroundColor: theme.colors.background,
                    ...styles.chart
                }}
                marker={{
                    enabled: true,
                    markerColor: processColor(theme.colors.backdrop),
                    textSize: 10,
                    textColor: processColor(theme.colors.accent)
                }}
                data={{
                    dataSets: [{
                        config: {
                            color: processColor(theme.colors.primary),
                            circleColor: processColor(theme.colors.primary),
                            highlightEnabled: true,
                            lineWidth: 2,
                            drawCircleHole: false,
                            highlightColor: processColor(theme.colors.accent),
                            circleRadius: 4,
                            mode: 'HORIZONTAL_BEZIER',
                        }, values: map
                    }]
                }}
                legend={{enabled: false}}
                xAxis={{
                    valueFormatter: 'date',
                    valueFormatterPattern: 'dd MMM',
                    position: 'BOTTOM_INSIDE',
                    textColor: processColor(theme.colors.text)
                }}
                yAxis={{
                    left: {textColor: processColor(theme.colors.text)},
                    right: {textColor: processColor(theme.colors.text)}
                }}
                chartDescription={{text: ''}}
                onSelect={(value) => handleDataPoíntSelcet(value)}/>}

            <ScrollView style={styles.exercise}>
                {selectedWorkout && <>
                    <Text style={{fontSize: 20}}>{getDateStringFromDate(selectedWorkout.end).toString()}</Text>
                    <WorkoutSetView sets={selectedWorkout?.sets ?? []}></WorkoutSetView>
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

export type Props = NativeStackScreenProps<RootStackParamList, 'Analyse'>;

export default AnalyseGraphics;
