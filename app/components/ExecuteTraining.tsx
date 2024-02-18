import React from "react";
import {View} from "react-native";
import AddWorkout from "./AddWorkout";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";

const ExecuteTraining = ({training, chosenExercise, onSubmit}: Props) => {
    let doneWorkoutId = training.doneWorkoutIds[chosenExercise.id!!];
    let doneWorkout = useWorkoutById(doneWorkoutId);
    return (
        <View>
            <AddWorkout workout={doneWorkout?.end ? doneWorkout : undefined} exercise={chosenExercise}
                        onSubmit={onSubmit}
                        suggest={false}
                        trainingsId={training.id!!}/>
        </View>
    );
}

interface Props {
    training: Training,
    chosenExercise: Exercise,
    onSubmit: () => void

}

export default ExecuteTraining;
