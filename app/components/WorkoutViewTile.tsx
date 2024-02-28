import {Card, IconButton, Text, useTheme} from "react-native-paper";
import {View} from "react-native";
import AddWorkoutSet from "./AddWorkoutSet";
import WorkoutSetView from "./WorkoutSetView";
import React, {useEffect, useState} from "react";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import useDeleteWorkout from "../redux/Workout/useDeleteWorkout";
import OutsidePressHandler from "react-native-outside-press";
import {Metric} from "./Picker";

interface WorkoutVieTileProps {
    workout: Workout,
    exercise: Exercise,
    highlightMode?: Metric,
    editable?: boolean
}

const WorkoutViewTile = ({workout, exercise, highlightMode, editable}: WorkoutVieTileProps) => {
    let theme = useTheme();
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let useDeleteWorkoutdispatch = useDeleteWorkout();
    const [showEdit, setShowEdit] = useState(false);
    //TODO workout set reihenfolge
    useEffect(() => {
    }, [workout, exercise]);

    function setShowEditWhenEditable(boool: boolean) {
        if (editable) {
            setShowEdit(boool);
        }
    }

    return (
        <OutsidePressHandler onOutsidePress={() => setShowEditWhenEditable(false)} key={workout.id}>
            <Card mode={"outlined"} style={{marginBottom: 5}} onLongPress={() => setShowEditWhenEditable(true)}>
                <View style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start'
                }}>
                    <Text
                        style={{
                            fontSize: theme.fonts.titleMedium.fontSize,
                            marginLeft: 5
                        }}>{exercise.name}</Text>
                    {showEdit &&
                        <IconButton style={{margin: 0, alignSelf: 'flex-start', height: 30}}
                                    icon={"delete"}
                                    onPress={() => useDeleteWorkoutdispatch(workout)}/>}
                </View>
                {
                    showEdit &&
                    <AddWorkoutSet onSubmit={(wokoutSet) => addOrUpdateSetInWorkout(wokoutSet, workout.id!!)}/>
                }
                <WorkoutSetView key={workout.id} sets={workout.sets} onDelete={(workoutSet) => {
                    deleteSetFromWorkout(workoutSet, workout);
                }} onSubmit={(workoutSet) => {
                    addOrUpdateSetInWorkout(workoutSet, workout.id!!);
                }} highLightMode={highlightMode} editable={editable}/>
            </Card>
        </OutsidePressHandler>
    )
}
export default WorkoutViewTile;
