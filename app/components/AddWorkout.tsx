import React, {useState} from "react";
import {useAllLastWorkouts} from "../redux/Workout/useAllLastWorkouts";
import {useUnfinishedWorkout} from "../redux/Workout/useUnfinishedWorkout";
import {Button, Text, useTheme} from "react-native-paper";
import {useDispatchAddWorkout} from "../redux/Workout/useDispatchAddWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchFinalizeWorkout} from "../redux/Workout/dispatchFinalizeWorkout";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchSuggest} from "../redux/Workout/dispatchSuggest";
import {ScrollView, StyleSheet, View} from "react-native";
import DatePicker from "./DatePicker";
import AddWorkoutSet from "./AddWorkoutSet";
import {oneRepMaxForWorkouts} from "../utils/RepetitionMaxHelper";

interface Props {
    exercise: Exercise
    onSubmit: () => void,
    historyCallback?: (start?: Date) => void,
    suggest?: boolean,
    trainingsId?: number,
    workout?: Workout
}

const AddWorkout = ({exercise, historyCallback, onSubmit, suggest, trainingsId, workout}: Props) => {
        let unfinishedWorkout = useUnfinishedWorkout(exercise.id!!);
        unfinishedWorkout = workout ?? unfinishedWorkout;
        const [date, setDate] = useState(new Date(Date.now()));
        let workouts = useAllLastWorkouts(exercise, 1);
        let oneRepMax = oneRepMaxForWorkouts(...workouts);
        let theme = useTheme();
        let addWorkout = useDispatchAddWorkout();
        let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
        let finalizeWorkout = dispatchFinalizeWorkout();
        let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
        let suggestedWorkout = dispatchSuggest();

        function submitWorkoutSet(workoutSet: WorkoutSet) {
            if (unfinishedWorkout === undefined) {
                addWorkout({
                    //TODO index should be set by reducer
                    // TODO nextTrainingsID should be handled by dispatch
                    sets: [{...workoutSet, index: workoutSet.index ?? 1}],
                    notes: '',
                    exerciseId: exercise.id!!!,
                    trainingsId: trainingsId,
                    start: date,
                }, trainingsId)
                return;
            }
            if (unfinishedWorkout.id === undefined) {
                addWorkout({
                    //TODO index should be set by reducer
                    sets: [{
                        ...workoutSet,
                        index: workoutSet.index ?? unfinishedWorkout!!.sets.map(it => it.index!!).reduce((a, b) => Math.max(a, b)) + 1
                    }],
                    notes: '',
                    exerciseId: exercise.id!!,
                    trainingsId: trainingsId,
                    start: date,
                }, trainingsId)
                return;
            }
            addOrUpdateSetInWorkout(workoutSet, unfinishedWorkout.id!!);
        }

        return (
            <ScrollView style={{backgroundColor: theme.colors.background}} keyboardShouldPersistTaps='handled'>
                {suggest &&
                    <Button buttonColor={theme.colors.tertiaryContainer} textColor={theme.colors.onTertiaryContainer}
                            disabled={unfinishedWorkout !== undefined || workouts.length === 0}
                            style={style.suggest} mode={"contained"}
                            onPress={() => {
                                suggestedWorkout(exercise.id!!);
                            }}>
                        Suggest
                    </Button>}
                <DatePicker date={date} setDate={setDate}/>
                {historyCallback &&
                    <Button buttonColor={theme.colors.tertiaryContainer} textColor={theme.colors.onTertiaryContainer}
                            style={style.historyLink} mode={"contained"}
                            onPress={() => historyCallback(workouts[0]?.start)}>
                        History
                    </Button>}
                <Text style={{
                    alignSelf: 'center',
                    marginTop: 20
                }}> Set {unfinishedWorkout?.sets ? unfinishedWorkout.sets.length + 1 : 1}</Text>
                <View style={{display: 'flex', justifyContent: 'flex-start'}}>
                    <AddWorkoutSet onSubmit={submitWorkoutSet}
                                   oneRepMax={oneRepMax}/>
                    {unfinishedWorkout && unfinishedWorkout.sets.map((workoutSet) => {
                        return <AddWorkoutSet
                            key={workoutSet.index}
                            workoutSet={workoutSet}
                            onSubmit={submitWorkoutSet}
                            onDelete={() => deleteSetFromWorkout(workoutSet, unfinishedWorkout!!)}/>
                    })}
                </View>
                {!workout && <Button
                    style={{marginTop: 20, display: 'flex', alignSelf: 'center'}}
                    buttonColor={theme.colors.primaryContainer}
                    textColor={theme.colors.onPrimaryContainer}
                    mode={'contained'}
                    disabled={unfinishedWorkout === undefined || unfinishedWorkout.id === undefined}
                    onPress={() => {
                        finalizeWorkout(new Date(Date.now()), unfinishedWorkout?.id!!);
                        onSubmit();
                    }}>
                    Add Workout
                </Button>}
            </ScrollView>
        )
            ;
    }
;

let style = StyleSheet.create({
    historyLink: {
        position: "absolute",
        top: 0,
        right: 5,
    },
    suggest: {
        position: "absolute",
        top: 0,
        left: 5,
    }
});


export default AddWorkout;
