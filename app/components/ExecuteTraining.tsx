import React from "react";
import {View} from "react-native";
import AddWorkout from "./AddWorkout";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";

const ExecuteTraining = ({training, choosenExercise, onSubmit}: Props) => {
    let doneWorkoutId = training.doneWorkoutIds[choosenExercise.id!!];
    let doneWorkout = useWorkoutById(doneWorkoutId);
    console.log(doneWorkout);
    return (
        <View>
            <AddWorkout workout={doneWorkout?.end ? doneWorkout : undefined} exercise={choosenExercise}
                        onSubmit={onSubmit}
                        suggest={false}
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
