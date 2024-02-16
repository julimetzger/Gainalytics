import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import useDeleteWorkout from "../redux/Workout/useDeleteWorkout";
import React, {useEffect} from "react";
import {View} from "react-native";
import {IconButton, Text} from "react-native-paper";
import {getDateStringFromDate} from "../utils/DateHelper";
import WorkoutSetView from "./WorkoutSetView";
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";

interface WorkoutViewProps {
    workoutIds: number[]
}

const WorkoutView = ({workoutIds}: WorkoutViewProps) => {
    let workouts = useWorkoutsByIds(workoutIds)
    let exercises = useExerciseByIds([...new Set(workouts)].map((workout: Workout) => workout.exerciseId));
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let useDeleteWorkoutdispatch = useDeleteWorkout();

    useEffect(() => {
    }, [workouts, workouts.map((workout: Workout) => workout.sets)]);

    return <>
        {
            workouts.map((workout) => {
                return (
                    <View>
                        <View style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start'
                        }}>
                            <Text
                                style={{fontSize: 20}}>{exercises.find((ex) => ex.id === workout.exerciseId)?.name + " " + getDateStringFromDate(workout.start)}</Text>
                            <IconButton style={{margin: 0, alignSelf: 'flex-start', height: 30}} icon={"delete"}
                                        onPress={() => useDeleteWorkoutdispatch(workout)}/>
                        </View>
                        <WorkoutSetView key={workout.id} sets={workout.sets} onDelete={(workoutSet) => {
                            deleteSetFromWorkout(workoutSet, workout);
                        }} onSubmit={(workoutSet) => {
                            addOrUpdateSetInWorkout(workoutSet, workout.id!!);
                        }}/>
                    </View>
                );
            })
        }
    </>;
}

export default WorkoutView;
