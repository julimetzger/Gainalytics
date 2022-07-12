import React, {useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import WorkoutSetView from "../tabs/WorkoutSetView";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";
import DateRangePicker from "../tabs/DateRangePicker";
import {firstDayOfWeek, getDateStringFromDate} from "../utils/DateHelper";

const History = () => {
    let now = new Date(Date.now());
    const [range, setRange] = useState({startDate: firstDayOfWeek(now, 1), endDate: now});
    let lastWorkouts = useWorkoutsIn(range).reverse() as Workout[];
    let lastExercises = lastWorkouts.map((workout: Workout) => workout.exerciseId);
    let exercises = new Map(useExerciseByIds(lastExercises).map((exercise: Exercise) => [exercise.id, exercise]));
    const theme = useTheme();
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}}>
            <DateRangePicker range={range} setRange={setRange}/>
            {lastWorkouts.map((workout) => {
                return (
                    <View>
                        <Text
                            style={{fontSize: 20}}>{exercises.get(workout.exerciseId)?.name + " " + getDateStringFromDate(workout.end)}</Text>
                        <WorkoutSetView sets={workout.sets}/>
                    </View>
                );
            })}
        </ScrollView>
    );
};

export default History;
