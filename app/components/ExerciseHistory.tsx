import React, {useState} from "react";
import WorkoutView from "./WorkoutView";
import {ScrollView} from "react-native";
import {useAllLastWorkouts} from "../redux/Workout/useAllLastWorkouts";
import {Exercise} from "../models/Exercise";

interface ExercisehistoryProps {
    exercise: Exercise;
    editable: boolean;
}

const ExerciseHistory = ({exercise, editable}: ExercisehistoryProps) => {
    const [numberOfWorkouts, setNumberOfWorkouts] = useState(10)
    let workouts = useAllLastWorkouts(exercise, numberOfWorkouts);
    return (
        <ScrollView>
            <WorkoutView
                workoutIds={workouts.map(workout => workout.id).filter(workoutId => workoutId !== undefined) as number[]}
                onEndReached={() => setNumberOfWorkouts(numberOfWorkouts + 10)} editable={editable}/>
        </ScrollView>)
        ;
}

export default ExerciseHistory;
