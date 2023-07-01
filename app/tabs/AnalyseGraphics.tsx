import React, {useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../tabs/DateRangePicker";
import {firstDayOfWeek, getDateStringFromDate, getEndOfDay, subtractMonths} from "../utils/DateHelper";
import ExercisePicker from "../tabs/ExercisePicker";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../routing/exerciseRouter";
import {ChartSelectEvent, LineChart, LineValue} from 'react-native-charts-wrapper';
import {repetitionMax} from "../utils/RepetitionMaxHelper";
import WorkoutSetView from "./WorkoutSetView";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";


const AnalyseGraphics = ({route}: Props) => {
    useEffect(() => {
            if (route?.params?.exercise !== undefined) {
                setExercise([route.params.exercise]);
                setRange(new Range(subtractMonths(1), getEndOfDay()))
            }
        }, [route]
    )

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
    let map = lastWorkouts.flatMap(value => [{
        id: value.id,
        x: value.start ? new Date(value.start).getTime() : undefined,
        y: repetitionMax(...value.sets)?.valueOf()
    } as LineValue]);
    return (
        <View style={{
            backgroundColor: theme.colors.background,
            display: 'flex',
            justifyContent: 'flex-start',

        }}>
            <DateRangePicker range={range} setRange={setRange}/>
            <ExercisePicker exercise={exercise} setExercise={setExercise}/>
            <LineChart
                style={styles.chart}
                data={{dataSets: [{label: "demo", values: map}]}}
                xAxis={{
                    valueFormatter: 'date',
                    valueFormatterPattern: 'dd MMM',
                    position: 'BOTTOM_INSIDE',
                }}
                onSelect={(value) => handleDataPoíntSelcet(value)}/>
            {selectedWorkout ?
                <View>
                    <Text style={{fontSize: 20}}>{" " + getDateStringFromDate(selectedWorkout.end).toString()}</Text>
                    <WorkoutSetView sets={selectedWorkout?.sets ?? []}></WorkoutSetView>
                </View> : null
            }
        </View>
    )
};


let styles = StyleSheet.create({
    chart: {
        backgroundColor: 'white',
        height: '60%',
        width: '100%'
    }
})

export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AnalyseGraphics;
