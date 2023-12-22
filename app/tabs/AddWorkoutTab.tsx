import React, {useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/exerciseRouter';
import {Button, Text, useTheme} from 'react-native-paper';
import {useDispatchAddWorkout} from '../redux/Workout/useDispatchAddWorkout';
import WorkoutSetView from "./WorkoutSetView";
import AddWorkoutSet from "../components/AddWorkoutSet";
import DatePicker from "./DatePicker";
import {useAllLastWorkouts} from "../redux/Workout/useAllLastWorkouts";
import {oneRepMaxForWorkouts} from "../utils/RepetitionMaxHelper";
import {useUnfinishedWorkout} from "../redux/Workout/useUnfinishedWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchFinalizeWorkout} from "../redux/Workout/dispatchFinalizeWorkout";

const AddWorkoutTab = ({navigation, route}: Props) => {
    let unfinishedWorkout = useUnfinishedWorkout(route.params.exercise.id!!);
    const [sets, setSets] = useState<WorkoutSet[]>(unfinishedWorkout ? unfinishedWorkout.sets : []);
    const [date, setDate] = useState(new Date(Date.now()));
    let workouts = useAllLastWorkouts(route.params.exercise, 1);
    let oneRepMax = oneRepMaxForWorkouts(...workouts);
    let theme = useTheme();
    let addWorkout = useDispatchAddWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let finalizeWorkout = dispatchFinalizeWorkout();
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}} keyboardShouldPersistTaps='handled'>
            <DatePicker date={date} setDate={setDate}/>
            <Button buttonColor={theme.colors.tertiaryContainer} textColor={theme.colors.onTertiaryContainer}
                    style={style.historyLink} mode={"contained"}
                    onPress={() => navigation.navigate('History', {
                        screen: 'History',
                        params: {exercise: route.params.exercise, lowerRangeBound: workouts[0]?.start}
                    })}>
                History
            </Button>
            <Text style={{alignSelf: 'center', marginTop: 20}}> Set {sets.length + 1}</Text>
            <AddWorkoutSet onSubmit={
                (workoutSet) => {
                    if (unfinishedWorkout === undefined) {
                        addWorkout({
                            sets: [workoutSet],
                            notes: '',
                            exerciseId: route.params.exercise.id!!,
                            start: date,
                        })
                    } else {
                        addOrUpdateSetInWorkout(workoutSet, unfinishedWorkout.id!!);
                    }
                    setSets([...sets, workoutSet])
                }} oneRepMax={oneRepMax}/>
            <WorkoutSetView sets={sets}

                            onDelete={(workoutSet) => setSets([...sets.filter(value => value.index!! !== workoutSet.index!!)])}
                            onSubmit={(workoutSet) => setSets([...sets.map(value => value.index!! === workoutSet.index!! ? workoutSet : value)])}/>
            <Button
                style={{marginTop: 20, display: 'flex', alignSelf: 'center'}}
                buttonColor={theme.colors.primaryContainer}
                textColor={theme.colors.onPrimaryContainer}
                mode={'contained'}
                disabled={sets.length === 0}
                onPress={() => {
                    finalizeWorkout(new Date(Date.now()), unfinishedWorkout?.id!!);
                    navigation.navigate({name: 'Exercises', params: undefined});
                }}>
                Add Workout
            </Button>
        </ScrollView>
    )
        ;
};

let style = StyleSheet.create({
    historyLink: {
        position: "absolute",
        top: 0,
        right: 10,
    }
});


export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AddWorkoutTab;
