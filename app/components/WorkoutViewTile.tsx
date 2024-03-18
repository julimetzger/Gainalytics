import {Card, IconButton, Text, useTheme} from "react-native-paper";
import {View} from "react-native";
import AddWorkoutSet from "./AddWorkoutSet";
import WorkoutSetView from "./WorkoutSetView";
import React, {memo, useState} from "react";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import useDeleteWorkout from "../redux/Workout/useDeleteWorkout";
import OutsidePressHandler from "react-native-outside-press";
import {Metric} from "./Picker";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {useExercise} from "../redux/Exercises/useExercise";

interface WorkoutVieTileProps {
    workoutId: number,
    highlightMode?: Metric,
    editable?: boolean
}

const WorkoutViewTile = ({workoutId, highlightMode, editable}: WorkoutVieTileProps) => {
    let date = new Date();
    let theme = useTheme();
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    let workout = useWorkoutById(workoutId);
    let userExercise = useExercise(workout.exerciseId);
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let useDeleteWorkoutdispatch = useDeleteWorkout();
    const [showEdit, setShowEdit] = useState(false);

    function setShowEditWhenEditable(boool: boolean) {
        if (editable) {
            setShowEdit(boool);
        }
    }

    return (
        <OutsidePressHandler onOutsidePress={() => setShowEditWhenEditable(false)} key={workout.id}>
            <Card mode={"outlined"} style={{marginBottom: 5}} onLongPress={() => setShowEditWhenEditable(true)}
                  key={workout.id}>
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
                        }}>{userExercise.name}</Text>
                    {showEdit &&
                        <IconButton style={{margin: 0, alignSelf: 'flex-start', height: 25}}
                                    icon={"delete"}
                                    onPress={() => {
                                        useDeleteWorkoutdispatch(workout)
                                        setShowEdit(false)
                                    }}/>}
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
export default memo(WorkoutViewTile, ((prevProps, nextProps) => {
    return prevProps.workoutId === nextProps.workoutId && prevProps.highlightMode === nextProps.highlightMode && prevProps.editable === nextProps.editable
}))
