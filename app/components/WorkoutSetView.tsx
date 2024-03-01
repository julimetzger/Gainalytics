import {View} from "react-native";
import {DataTable, Icon} from 'react-native-paper';
import React, {useEffect, useState} from "react";
import AddWorkoutSet from "./AddWorkoutSet";
import {Metric} from "./Picker";
import {calculateMetricValue} from "../utils/RepetitionMaxHelper";

const WorkoutSetView = ({sets, onDelete, onSubmit, editable = true, highLightMode}: WorkoutSetViewProps) => {
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
    let highlightValue = highLightMode ? calculateMetricValue(sets, highLightMode) : undefined;

    console.log("sets", sets)
    function showSets(set: WorkoutSet) {
        return (
            <DataTable.Row style={{padding: 0, margin: 0, minHeight: 35}} key={set.index}
                           onPress={() => {
                if (editable) {
                    setSetToUpdate(set);
                }
            }}>
                <DataTable.Cell>{set.reps + " reps"}</DataTable.Cell>
                <DataTable.Cell>{set.rir + " RIR"}</DataTable.Cell>
                <DataTable.Cell>{set.weight + " kg"}</DataTable.Cell>
                {highLightMode && (highLightMode === Metric.MAX_INTENSITY || highLightMode === Metric.ONE_RM) && highlightValue === calculateMetricValue([set], highLightMode) &&
                    <DataTable.Cell><Icon size={10} source={"trophy"}/>
                    </DataTable.Cell>
                }
            </DataTable.Row>
        )
    }

    return (
        <View>
            {workoutsBefore.map(showSets)}
            {setToUpdate &&
                <AddWorkoutSet
                    onSubmit={(arg) => {
                        onSubmit(arg);
                        setSetToUpdate(undefined);
                    }}
                    onDelete={(workout) => {
                        onDelete(workout);
                        setSetToUpdate(undefined);
                    }}
                    workoutSet={setToUpdate}
                    hasToSaveManually={true}/>
            }
            {workoutsAfter.map(showSets)}
        </View>
    );
}

interface WorkoutSetViewProps {
    sets: WorkoutSet[],
    onDelete: (workoutSet: WorkoutSet) => void,
    onSubmit: (workoutSet: WorkoutSet) => void
    editable?: boolean
    highLightMode?: Metric
}


export default WorkoutSetView;
