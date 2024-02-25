import React, {useEffect} from "react";
import {StyleSheet} from "react-native";
import {Card, Text, useTheme} from "react-native-paper";
import {getDateStringFromDate} from "../utils/DateHelper";
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import {Range} from "./DateRangePicker";
import WorkoutViewTile from "./WorkoutViewTile";

interface WorkoutViewProps {
    workoutIds: number[]
}

const HOURS_IN_MILLIS = 60 * 60 * 1000;
const WorkoutView = ({workoutIds}: WorkoutViewProps) => {
    let theme = useTheme();
    let workouts = useWorkoutsByIds(workoutIds)
    let exercises = useExerciseByIds([...new Set(workouts)].map((workout: Workout) => workout.exerciseId));
    let dateWorkoutMap = new Map<Date, Workout[]>();
    useEffect(() => {
    }, [workouts, workouts.map((workout: Workout) => workout.sets)]);

    workouts.forEach(
        (workout) => {
            let sameWorkoutDate: Date = Array.from(dateWorkoutMap.keys()).find((date) =>
                    new Range(new Date(new Date(date).getTime() - HOURS_IN_MILLIS * 5), new Date(new Date(date).getTime() + HOURS_IN_MILLIS * 5)).dateIsInRange(workout.start!!))
                ?? workout.start!!;
            dateWorkoutMap.set(sameWorkoutDate, [...dateWorkoutMap.get(sameWorkoutDate) ?? [], workout]);
        }
    )

    const styles = StyleSheet.create({
        exerciseText: {
            fontSize: theme.fonts.titleLarge.fontSize,
            marginLeft: 5,
        },
    });

    return <>
        {
            Array.from(dateWorkoutMap.entries()).map(([date, workouts]) => {
                return (
                    <Card mode={'contained'} style={{marginBottom: 10}}>
                        <Text style={styles.exerciseText}>
                            {getDateStringFromDate(new Date(date))}</Text>

                        {workouts.map((workout) => {
                            return <WorkoutViewTile workout={workout}
                                                    exercise={exercises.find((ex) => ex.id === workout.exerciseId)!!}/>;
                        })
                        }
                    </Card>)
            })
        }
    </>;
}


export default WorkoutView;
