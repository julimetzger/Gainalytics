import React from 'react';
import {ScrollView, View} from 'react-native';
import {useAllLastWorkouts} from '../redux/Workout/useAllLastWorkouts';
import {Text, useTheme} from 'react-native-paper';
import {useExerciseById} from "../redux/Exercises/useExerciseById";
import WorkoutSetView from "../tabs/WorkoutSetView";

const History = () => {
        let lastWorkouts = useAllLastWorkouts();
        let exerciseToDate = new Map(lastWorkouts.map((workout: Workout) => [useExerciseById(workout.exerciseId).name as string, workout]));
        const theme = useTheme();
        return (
            <ScrollView style={{backgroundColor: theme.colors.background}}>
                <View>
                    {Array.from(exerciseToDate.entries(), ([key, workout]) => {
                        return (
                            <View>
                                <Text>{key + " " + getDateStringFromDate(workout.end)}</Text>
                                <WorkoutSetView sets={workout.sets}/>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        )
            ;
    }
;

const getDateStringFromDate = (date?: Date | number) => {
    if (typeof date === 'number') {
        return  new Date(date).toDateString();
    } else {
        return  date?.toDateString();
    }
}

export default History;
