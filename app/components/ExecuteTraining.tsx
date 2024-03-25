import React from "react";
import {View} from "react-native";
import AddWorkout from "./AddWorkout";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {useNextTrainingsId} from "../redux/Training/useNextTrainingsId";
import {Training} from "../models/Training";
import {Exercise} from "../models/Exercise";
import {WorkoutSet} from "../models/WorkoutSet";

const ExecuteTraining = ({training, chosenExercise, onSubmit,onSubmitSet}: Props) => {
    let doneWorkoutId = training.doneWorkoutIds[chosenExercise.id!!];
    let doneWorkout = useWorkoutById(doneWorkoutId);
    let nextTrainingsId = useNextTrainingsId();
    //TODO exercise während Training hinzugefügt und Sätze hinzugefügt (kein AddWorkout). Dann app zugemacht. Dann wieder geöffnet. Dann ist  Training nicht mehr da.
    return (
        <View>
            <AddWorkout workout={doneWorkout?.end ? doneWorkout : undefined} exercise={chosenExercise}
                        onSubmit={onSubmit}
                        suggest={false}
                        trainingsId={training.id ?? nextTrainingsId}
                        onSubmitSet={onSubmitSet}/>
        </View>
    );
}

interface Props {
    training: Training,
    chosenExercise: Exercise,
    onSubmit: () => void,
    onSubmitSet?: (workoutSet: WorkoutSet) => void

}

export default ExecuteTraining;
