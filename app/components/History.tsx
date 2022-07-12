import React from 'react';
import {ScrollView, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import WorkoutSetView from "../tabs/WorkoutSetView";
import {useWorkoutsIn} from "../redux/Workout/useWorkoutsIn";

const History = () => {
    let now = new Date(Date.now());
    let lastWorkouts = useWorkoutsIn(firstDayOfWeek(now, 1), now).reverse() as Workout[];
    let lastExercises = lastWorkouts.map((workout: Workout) => workout.exerciseId);
    let exercises = new Map (useExerciseByIds(lastExercises).map((exercise:Exercise)=> [exercise.id, exercise]));
    const theme = useTheme();
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}}>
                {lastWorkouts.map((workout) => {
                    return (
                        <View>
                            <Text style={{fontSize: 20}}>{exercises.get(workout.exerciseId)?.name + " " + getDateStringFromDate(workout.end)}</Text>
                            <WorkoutSetView sets={workout.sets}/>
                        </View>
                    );
                })}
        </ScrollView>
    );
};

function firstDayOfWeek(dateObject: Date, firstDayOfWeekIndex: number) {

    const dayOfWeek = dateObject.getDay(),
        firstDayOfWeek = new Date(dateObject),
        diff = dayOfWeek >= firstDayOfWeekIndex ?
            dayOfWeek - firstDayOfWeekIndex :
            6 - dayOfWeek

    firstDayOfWeek.setDate(dateObject.getDate() - diff)
    firstDayOfWeek.setHours(0, 0, 0, 0)

    return firstDayOfWeek
}

const getDateStringFromDate = (date?: Date | number) => {
    if (typeof date === 'number') {
        return new Date(date).toDateString();
    } else {
        return date?.toDateString();
    }
}

export default History;
