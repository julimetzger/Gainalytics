import React from "react";
import WorkoutView from "./WorkoutView";
import {View} from "react-native";

interface Props {
    training: Training;
}

const TrainingHistory = ({training}: Props) => {
    return (
        <View>
            {
                training.doneWorkoutIds &&
                <WorkoutView workoutIds={Object.values(training.doneWorkoutIds)}/>
            }
        </View>
    )
}
export default TrainingHistory;
