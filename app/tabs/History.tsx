import React, {useEffect, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Divider, Text, useTheme} from 'react-native-paper';
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker, {Range} from "../components/DateRangePicker";
import {firstDayOfWeek, getEndOfDay, lastDayOfWeek, subtractMonths} from "../utils/DateHelper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {repetitionMax} from "../utils/RepetitionMaxHelper";
import {RootStackParamList} from "../routing/HistoryRouter";
import WorkoutView from "../components/WorkoutView";
import Picker from "../components/Picker";

const History = ({route}: Props) => {
    useEffect(() => {
            if (route?.params?.exercise !== undefined) {
                setExercise([route.params.exercise]);
                setRange(new Range(route?.params?.lowerRangeBound ? subtractMonths(1, new Date(route.params.lowerRangeBound)) : subtractMonths(1), getEndOfDay()))
            }
        }, [route]
    )
    let now = new Date(Date.now());
    const [range, setRange] = useState(new Range(firstDayOfWeek(now, 1), lastDayOfWeek(now,0)))
    const [exercise, setExercise] = useState<Exercise[]>([]);
    let exerciseIDs = exercise.map(it => it.id);
    let lastWorkouts = useWorkoutsIn(range)
        .filter((workout: Workout) => exercise.length > 0 ? exerciseIDs.includes(workout.exerciseId) : true)

    const theme = useTheme();
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}} keyboardShouldPersistTaps={"handled"}>
            <DateRangePicker range={range} setRange={setRange}/>
            <Picker exercise={exercise} setExercise={setExercise} muscles={true}/>
            <View>
                <WorkoutView workoutIds={lastWorkouts.map(workout => workout.id).filter(workoutId => workoutId !== undefined) as number[]}/>
            </View>
            <Divider/>
            <View>
                <Text> Volume: {lastWorkouts.reduce<number>((previousValue: number, currentValue) => previousValue + currentValue.sets.reduce<number>((previousValue1, currentValue1) => previousValue1 + currentValue1.reps * currentValue1.weight, 0), 0)} kg</Text>
                <Text> 1RM: {lastWorkouts.length > 0 ? repetitionMax(...lastWorkouts.flatMap(value => value.sets)).toFixed(2) : 0} kg</Text>
            </View>
        </ScrollView>
    );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default History;
