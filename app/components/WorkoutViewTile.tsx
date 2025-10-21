import React, {memo, useState} from "react";
import {StyleSheet, View} from "react-native";
import {Card, IconButton, Text, useTheme} from "react-native-paper";
import OutsidePressHandler from "react-native-outside-press";
import AddWorkoutSet from "./AddWorkoutSet";
import WorkoutSetView from "./WorkoutSetView";
import {Metric} from "./Picker";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import useDeleteWorkout from "../redux/Workout/useDeleteWorkout";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {useExercise} from "../redux/Exercises/useExercise";

interface WorkoutViewTileProps {
    workoutId: number;
    highlightMode?: Metric;
    editable?: boolean;
}

const WorkoutViewTile = ({workoutId, highlightMode, editable}: WorkoutViewTileProps) => {
    const theme = useTheme();
    const [showEdit, setShowEdit] = useState(false);
    
    const workout = useWorkoutById(workoutId);
    const userExercise = useExercise(workout.exerciseId);
    const deleteWorkout = useDeleteWorkout();
    const deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    const addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout(userExercise);

    const setShowEditWhenEditable = (shouldShow: boolean) => {
        if (editable) {
            setShowEdit(shouldShow);
        }
    };

    const effectiveHighlightMode = highlightMode || 
        (workout?.records && Object.keys(workout.records).pop() as keyof typeof Metric);

    return (
        <View>
            {editable ? (
                <OutsidePressHandler 
                    onOutsidePress={() => setShowEditWhenEditable(false)} 
                    key={workout.id}
                >
                    <Card 
                        mode="outlined" 
                        style={styles.card} 
                        onLongPress={() => setShowEditWhenEditable(true)}
                        key={workout.id}
                    >
                        <View style={styles.exercise}>
                            <Text style={[styles.title, {fontSize: theme.fonts.titleMedium.fontSize}]}>
                                {userExercise.name}
                            </Text>
                            {showEdit && (
                                <IconButton 
                                    style={styles.deleteIcon}
                                    icon="delete"
                                    onPress={() => {
                                        deleteWorkout(workout);
                                        setShowEdit(false);
                                    }}
                                />
                            )}
                        </View>
                        
                        {showEdit && (
                            <AddWorkoutSet onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)} />
                        )}
                        
                        <WorkoutSetView 
                            key={workout.id} 
                            sets={workout.sets} 
                            onDelete={(workoutSet) => deleteSetFromWorkout(workoutSet, workout)}
                            onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)}
                            highLightMode={effectiveHighlightMode}
                            editable={editable}
                        />
                    </Card>
                </OutsidePressHandler>
            ) : (
                <Card 
                    mode="outlined" 
                    style={styles.card} 
                    onLongPress={() => setShowEditWhenEditable(true)}
                    key={workout.id}
                >
                    <View  style={styles.exercise}>
                        <Text style={[styles.title, {fontSize: theme.fonts.titleMedium.fontSize}]}>
                            {userExercise.name}
                        </Text>
                        {showEdit && (
                            <IconButton 
                                style={styles.deleteIcon}
                                icon="delete"
                                onPress={() => {
                                    deleteWorkout(workout);
                                    setShowEdit(false);
                                }}
                            />
                        )}
                    </View>
                    
                    {showEdit && (
                        <AddWorkoutSet onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)} />
                    )}
                    
                    <WorkoutSetView 
                        key={workout.id} 
                        sets={workout.sets} 
                        onDelete={(workoutSet) => deleteSetFromWorkout(workoutSet, workout)}
                        onSubmit={(workoutSet) => addOrUpdateSetInWorkout(workoutSet, workout)}
                        highLightMode={effectiveHighlightMode}
                        editable={editable}
                    />
                </Card>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 0,
    },
    exercise: {
        flex: 1,
        flexDirection: 'row',
    },
    title: {
        marginLeft: 10,
    },
    deleteIcon: {
        margin: 0,
        height: 25
    }
});

export default memo(WorkoutViewTile, ((prevProps, nextProps) => {
    return prevProps.workoutId === nextProps.workoutId && prevProps.highlightMode === nextProps.highlightMode && prevProps.editable === nextProps.editable
}))
