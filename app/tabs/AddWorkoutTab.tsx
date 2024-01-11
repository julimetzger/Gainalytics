import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/exerciseRouter';
import {Button, Text, useTheme} from 'react-native-paper';
import {useDispatchAddWorkout} from '../redux/Workout/useDispatchAddWorkout';
import AddWorkoutSet from "../components/AddWorkoutSet";
import DatePicker from "./DatePicker";
import {useAllLastWorkouts} from "../redux/Workout/useAllLastWorkouts";
import {oneRepMaxForWorkouts} from "../utils/RepetitionMaxHelper";
import {useUnfinishedWorkout} from "../redux/Workout/useUnfinishedWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchFinalizeWorkout} from "../redux/Workout/dispatchFinalizeWorkout";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchSuggest} from "../redux/Workout/dispatchSuggest";

const AddWorkoutTab = ({navigation, route}: Props) => {
        let unfinishedWorkout = useUnfinishedWorkout(route.params.exercise.id!!);
        const [date, setDate] = useState(new Date(Date.now()));
        let workouts = useAllLastWorkouts(route.params.exercise, 1);
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
                    sets: [{...workoutSet, index: workoutSet.index ?? 1}],
                    notes: '',
                    exerciseId: route.params.exercise.id!!,
                    start: date,
                })
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
                    exerciseId: route.params.exercise.id!!,
                    start: date,
                })
                return;
            }
            addOrUpdateSetInWorkout(workoutSet, unfinishedWorkout.id!!);
        }

        return (
            <ScrollView style={{backgroundColor: theme.colors.background}} keyboardShouldPersistTaps='handled'>
                <Button buttonColor={theme.colors.tertiaryContainer} textColor={theme.colors.onTertiaryContainer}
                        disabled={unfinishedWorkout !== undefined || workouts.length === 0}
                        style={style.suggest} mode={"contained"}
                        onPress={() => {
                            suggestedWorkout(route.params.exercise.id!!);
                        }}>
                    Suggest
                </Button>
                <DatePicker date={date} setDate={setDate}/>
                <Button buttonColor={theme.colors.tertiaryContainer} textColor={theme.colors.onTertiaryContainer}
                        style={style.historyLink} mode={"contained"}
                        onPress={() => navigation.navigate('History', {
                            screen: 'History',
                            params: {exercise: route.params.exercise, lowerRangeBound: workouts[0]?.start}
                        })}>
                    History
                </Button>
                <Text style={{
                    alignSelf: 'center',
                    marginTop: 20
                }}> Set {unfinishedWorkout?.sets ? unfinishedWorkout.sets.length + 1 : 1}</Text>
                <View style={{justifyContent: 'flex-start'}}>
                    <AddWorkoutSet onSubmit={submitWorkoutSet}
                                   oneRepMax={oneRepMax}/>
                    {unfinishedWorkout && unfinishedWorkout.sets.map((workoutSet) => {
                        return <AddWorkoutSet workoutSet={workoutSet}
                                              onSubmit={submitWorkoutSet}
                                              onDelete={() => deleteSetFromWorkout(workoutSet, unfinishedWorkout!!.id, unfinishedWorkout!!.exerciseId)}/>
                    })}
                </View>
                <Button
                    style={{marginTop: 20, display: 'flex', alignSelf: 'center'}}
                    buttonColor={theme.colors.primaryContainer}
                    textColor={theme.colors.onPrimaryContainer}
                    mode={'contained'}
                    disabled={unfinishedWorkout === undefined || unfinishedWorkout.id === undefined}
                    onPress={() => {
                        finalizeWorkout(new Date(Date.now()), unfinishedWorkout?.id!!);
                        navigation.navigate({name: 'Exercises', params: undefined});
                    }}>
                    Add Workout
                </Button>
            </ScrollView>
        )
            ;
    }
;

let style = StyleSheet.create({
    historyLink: {
        position: "absolute",
        top: 0,
        right: 10,
    },
    suggest: {
        position: "absolute",
        top: 0,
        right: 290,
    }
});


export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AddWorkoutTab;
