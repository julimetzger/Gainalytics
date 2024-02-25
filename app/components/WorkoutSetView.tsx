import {View} from "react-native";
import {DataTable, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from "react";
import AddWorkoutSet from "./AddWorkoutSet";

const WorkoutSetView = ({sets, onDelete, onSubmit}: WorkoutSetViewProps) => {
    const [setToUpdate, setSetToUpdate] = useState<WorkoutSet>();
    let indexOfSelectedWorkout = setToUpdate ? sets.indexOf(setToUpdate) : undefined;
    let workoutsBefore: WorkoutSet[] = [];
    let workoutsAfter: WorkoutSet[];
    if (indexOfSelectedWorkout !== undefined && indexOfSelectedWorkout !== -1) {
        workoutsBefore = sets.slice(0, indexOfSelectedWorkout);
        workoutsAfter = sets.slice(indexOfSelectedWorkout + 1);
    } else {
        workoutsAfter = sets;
    }
    useEffect(() => {
    }, [sets]);

    function showSets(training: WorkoutSet) {
        return (
            <DataTable.Row style={{padding: 0, margin: 0, minHeight: 35}} key={training.index} id={training.index!!.toString()} onPress={() => {
                setSetToUpdate(training);
            }}>
                <DataTable.Cell>{training.reps + " reps"}</DataTable.Cell>
                <DataTable.Cell>{training.rir + " RIR"}</DataTable.Cell>
                <DataTable.Cell>{training.weight + " kg"}</DataTable.Cell>
            </DataTable.Row>
        )
    }

    return <View>
        {workoutsBefore.map(showSets)}
        {setToUpdate && <AddWorkoutSet onSubmit={(arg) => {
            onSubmit(arg);
            setSetToUpdate(undefined);
        }}
                                       onDelete={(workout) => {
                                           onDelete(workout);
                                           setSetToUpdate(undefined);
                                       }}
                                       workoutSet={setToUpdate}
                                       hasToSaveManually={true}/>}
        {workoutsAfter.map(showSets)}
    </View>;
}

interface WorkoutSetViewProps {
    sets: WorkoutSet[],
    onDelete: (workoutSet: WorkoutSet) => void,
    onSubmit: (workoutSet: WorkoutSet) => void
}


export default WorkoutSetView;
