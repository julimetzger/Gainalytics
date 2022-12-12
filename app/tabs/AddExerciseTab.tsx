import React, {useState} from 'react';
import {ScrollView} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/exerciseRouter';
import {Button, useTheme} from 'react-native-paper';
import {useDispatchAddSetToTraining} from '../redux/Workout/dispatchAddSetToTraining';
import WorkoutSetView from "./WorkoutSetView";
import AddWorkoutSet from "../components/AddWorkoutSet";

const AddExerciseTab = (props: Props) => {
    const [sets, setSets] = useState<WorkoutSet[]>([]);
    let dispatchAddSetToTraining = useDispatchAddSetToTraining();
    const theme = useTheme();
    const today = new Date();
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}}>
            <AddWorkoutSet onAdd={
                (workoutSet) => setSets([...sets, workoutSet])}
                           today={today}/>
            <WorkoutSetView sets={sets}/>
            <Button
                onPress={() => {
                    dispatchAddSetToTraining({sets: sets, notes: '', exerciseId: props.route.params.exercise.id!!});
                    props.navigation.navigate({name: 'Exercises', params: undefined});
                }}>
                Add Workout
            </Button>
        </ScrollView>
    );
};


export type Props = NativeStackScreenProps<RootStackParamList, 'AddExerciseTab'>;

export default AddExerciseTab;
