import {View} from "react-native";
import {DataTable, Icon, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from "react";
import AddWorkoutSet from "./AddWorkoutSet";
import {Metric} from "./Picker";
import {calculateMetricValue} from "../utils/RepetitionMaxHelper";
import {WorkoutSet} from "../models/WorkoutSet";

const WorkoutSetView = ({sets, onDelete, onSubmit, editable = true, highLightMode}: WorkoutSetViewProps) => {
    const theme = useTheme();
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
    function showSets(set: WorkoutSet) {
        return (
            <DataTable.Row style={{minHeight: 35}}
                           key={set.index!! + set.reps + set.rir + set.weight + (set.date ? new Date(set.date).getTime().toString() : "")}
                           onPress={() => {
                               if (editable) {
                                   setSetToUpdate(set);
                               }
                           }}>
                <DataTable.Cell style={{flex: 6}}>{set.reps + " reps"}</DataTable.Cell>
                <DataTable.Cell style={{flex: 6}}>{set.rir + " RIR"}</DataTable.Cell>
                <DataTable.Cell style={{flex: 6}}>{set.weight + " kg"}</DataTable.Cell>
                <DataTable.Cell style={{flex: 1}}>{highLightMode && (highLightMode === Metric.MAX_INTENSITY || highLightMode === Metric.ONE_RM) && highlightValue === calculateMetricValue([set], highLightMode) ?
                    <Icon size={15} source={"trophy"} color={theme.colors.primary}/>
                    : null}
                </DataTable.Cell>
            </DataTable.Row>
        )
    }

    return (
        <View>
            {workoutsBefore.map(showSets)}
            {setToUpdate &&
                <AddWorkoutSet
                    onSubmit={(arg) => {
                        onSubmit!!(arg);
                        setSetToUpdate(undefined);
                    }}
                    onDelete={(workout) => {
                        onDelete!!(workout);
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
    onDelete?: (workoutSet: WorkoutSet) => void,
    onSubmit?: (workoutSet: WorkoutSet) => void
    editable?: boolean
    highLightMode?: Metric
}

export default WorkoutSetView;
