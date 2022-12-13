import {View} from "react-native";
import {DataTable} from 'react-native-paper';
import React, {useState} from "react";
import EditWorkoutSetDialog from "../components/EditWorkoutSetDialog";

const WorkoutSetView = ({sets, onDelete, onSubmit}: WorkoutSetViewProps) => {
    const [visible, setVisible] = useState(false);
    const [training, setTraining] = useState<WorkoutSet>();
    return <View>
        {sets.map((training) => {
            return (
                <DataTable.Row onPress={() => {
                    setTraining(training);
                    setVisible(true);
                }}>
                    <DataTable.Cell>{training.reps + " reps"}</DataTable.Cell>
                    <DataTable.Cell>{training.weight + " kg"}</DataTable.Cell>
                    <DataTable.Cell>{training.rir + " RIR"}</DataTable.Cell>
                </DataTable.Row>
            )
        })}
        <EditWorkoutSetDialog workoutSet={training}
                              visible={visible}
                              setVisible={setVisible}
                              onDelete={onDelete}
                              onSubmit={onSubmit}/>
    </View>;
}

interface WorkoutSetViewProps {
    sets: WorkoutSet[],
    onDelete: (workoutSet: WorkoutSet) => void,
    onSubmit: (workoutSet: WorkoutSet) => void
}

export default WorkoutSetView;
