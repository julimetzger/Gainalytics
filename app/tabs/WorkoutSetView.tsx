import {View} from "react-native";
import { DataTable } from 'react-native-paper';
import React from "react";

const WorkoutSetView = ({sets} :WorkoutSetViewProps ) => {
    return <View>
        {sets.map((training) => (
            <DataTable.Row>
                <DataTable.Cell>{training.reps+" reps"}</DataTable.Cell>
                <DataTable.Cell>{training.weight+ " kg"}</DataTable.Cell>
                <DataTable.Cell>{training.rir+ " RIR"}</DataTable.Cell>
            </DataTable.Row>
        ))}
    </View>;
}

interface WorkoutSetViewProps {
    sets: WorkoutSet[]
}

export default WorkoutSetView;
