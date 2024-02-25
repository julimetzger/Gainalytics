import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import useDeleteWorkout from "../redux/Workout/useDeleteWorkout";
import React, {useEffect, useState} from "react";
import {StyleSheet, View} from "react-native";
import {Card, IconButton, Surface, Text, useTheme} from "react-native-paper";
import {getDateStringFromDate} from "../utils/DateHelper";
import WorkoutSetView from "./WorkoutSetView";
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import {Range} from "./DateRangePicker";

interface WorkoutViewProps {
    workoutIds: number[]
}

const WorkoutView = ({workoutIds}: WorkoutViewProps) => {
    let theme = useTheme();
    let workouts = useWorkoutsByIds(workoutIds)
    const [showDelete, setShowDelete] = useState(false);
    let exercises = useExerciseByIds([...new Set(workouts)].map((workout: Workout) => workout.exerciseId));
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let useDeleteWorkoutdispatch = useDeleteWorkout();
    let dateWorkoutMap = new Map<Date, Workout[]>();
    useEffect(() => {
    }, [workouts, workouts.map((workout: Workout) => workout.sets)]);

    workouts.forEach(
        (workout) => {
            let sameWorkoutDate: Date = Array.from(dateWorkoutMap.keys()).find((date) =>
                    new Range(new Date(new Date(date).getTime() - 60 * 60 * 5 * 1000), new Date(new Date(date).getTime() + 60 * 60 * 5 * 1000)).dateIsInRange(workout.start!!))
                ?? workout.start!!;
            dateWorkoutMap.set(sameWorkoutDate, [...dateWorkoutMap.get(sameWorkoutDate) ?? [], workout]);
        }
    )

    const styles = StyleSheet.create({
        exerciseText: {
            fontSize: theme.fonts.titleLarge.fontSize,
            marginLeft: 5,
        },
        addExercise: {
            position: 'absolute',
            bottom: 5,
            right: 5
        },
        editExercise: {}
    });

    return <>
        {
            Array.from(dateWorkoutMap.entries()).map(([date, workouts]) => {
                return (
                    <Card mode={'contained'} style={{marginBottom: 10}} onLongPress={() => setShowDelete(!showDelete)}>
                        <Text style={styles.exerciseText}>
                            {getDateStringFromDate(new Date(date))}</Text>
                        {workouts.map((workout) => {
                            return (
                                <Surface elevation={1} style={{marginBottom: 5}}>
                                    <View style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        justifyContent: 'flex-start'
                                    }}>
                                        <Text
                                            style={{fontSize: theme.fonts.titleMedium.fontSize, marginLeft: 5}}>{exercises.find((ex) => ex.id === workout.exerciseId)?.name}</Text>
                                        {showDelete &&
                                            <IconButton style={{margin: 0, alignSelf: 'flex-start', height: 30}}
                                                        icon={"delete"}
                                                        onPress={() => useDeleteWorkoutdispatch(workout)}/>}
                                    </View>
                                    <WorkoutSetView key={workout.id} sets={workout.sets} onDelete={(workoutSet) => {
                                        deleteSetFromWorkout(workoutSet, workout);
                                    }} onSubmit={(workoutSet) => {
                                        addOrUpdateSetInWorkout(workoutSet, workout.id!!);
                                    }}/>
                                </Surface>
                            )
                        })
                        }
                    </Card>)
            })
        }
    </>;
}


export default WorkoutView;
