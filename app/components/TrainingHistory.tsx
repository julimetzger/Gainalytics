import React from "react";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import WorkoutSetView from "./WorkoutSetView";

interface Props {
    training: Training;
    choosenExercise: Exercise;
}

const TrainingHistory = ({training, choosenExercise}: Props) => {
    let doneWorkoutId = training.doneWorkoutIds[choosenExercise.id!!];
    let doneWorkout = useWorkoutById(doneWorkoutId);

    return (
        <WorkoutSetView sets={doneWorkout.sets} onDelete={() => {
        }}
                        onSubmit={() => {
                        }}/>)

}
export default TrainingHistory;
