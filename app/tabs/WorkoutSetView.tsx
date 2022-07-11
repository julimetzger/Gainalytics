import {View} from "react-native";
import {Text} from "react-native-paper";
import React from "react";

const WorkoutSetView = ({sets} :WorkoutSetViewProps ) => {
    return <View>
        {sets.map((training) => (
            <Text>
                {training.reps}@{training.weight} rir {training.rir}
            </Text>
        ))}
    </View>;
}

interface WorkoutSetViewProps {
    sets: WorkoutSet[]
}

export default WorkoutSetView;
