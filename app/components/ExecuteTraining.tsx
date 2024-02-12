import React from "react";
import {View} from "react-native";
import AddWorkout from "./AddWorkout";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";

const ExecuteTraining = ({training, choosenExercise, onSubmit}: Props) => {
    // TODO show finished workouts


    return (
        <View>
            <AddWorkout exercise={choosenExercise} onSubmit={onSubmit} suggest={false}
                        trainingsId={training.id!!}/>
        </View>
    );
}

interface Props {
    training: Training,
    choosenExercise: Exercise,
    onSubmit: () => void

}

export default ExecuteTraining;
