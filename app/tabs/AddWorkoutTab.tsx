import React, {useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/exerciseRouter';
import {Button, Text, useTheme} from 'react-native-paper';
import {useDispatchAddSetToTraining} from '../redux/Workout/dispatchAddSetToTraining';
import WorkoutSetView from "./WorkoutSetView";
import AddWorkoutSet from "../components/AddWorkoutSet";
import DatePicker from "./DatePicker";
import {useAllLastWorkouts} from "../redux/Workout/useAllLastWorkouts";
import {oneRepMaxForWorkouts} from "../utils/RepetitionMaxHelper";

const AddWorkoutTab = ({navigation, route}: Props) => {
    const [sets, setSets] = useState<WorkoutSet[]>([]);
    const [date, setDate] = useState(new Date(Date.now()));
    let workouts = useAllLastWorkouts(route.params.exercise, 1);
    let oneRepMax = oneRepMaxForWorkouts(...workouts);
    let theme = useTheme();
    let dispatchAddSetToTraining = useDispatchAddSetToTraining();
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}} keyboardShouldPersistTaps='handled'>
            <DatePicker date={date} setDate={setDate}/>
            <Button color={theme.colors.accent} style={style.historyLink}
                    onPress={() => navigation.navigate('History', {
                        screen: 'History',
                        params: {exercise: route.params.exercise, lowerRangeBound: workouts[0]?.start}
                    })}>
                History
            </Button>
            <Text style={{alignSelf: 'center'}}> Set {sets.length + 1}</Text>
            <AddWorkoutSet onSubmit={
                (workoutSet) => setSets([...sets, workoutSet])} oneRepMax={oneRepMax}/>
            <WorkoutSetView sets={sets}
                            onDelete={(workoutSet) => setSets([...sets.filter(value => value.index!! !== workoutSet.index!!)])}
                            onSubmit={(workoutSet) => setSets([...sets.map(value => value.index!! === workoutSet.index!! ? workoutSet : value)])}/>
            <Button
                onPress={() => {
                    dispatchAddSetToTraining({
                        sets: sets,
                        notes: '',
                        exerciseId: route.params.exercise.id!!,
                        start: date,
                        end: date
                    });
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
        right: 0,
    }
});


export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AddWorkoutTab;
