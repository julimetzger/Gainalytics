import React, {useState} from 'react';
import {ScrollView} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/exerciseRouter';
import {Button, Text, useTheme} from 'react-native-paper';
import {useDispatchAddSetToTraining} from '../redux/Workout/dispatchAddSetToTraining';
import WorkoutSetView from "./WorkoutSetView";
import AddWorkoutSet from "../components/AddWorkoutSet";
import DatePicker from "./DatePicker";

const AddWorkoutTab = (props: Props) => {
    const [sets, setSets] = useState<WorkoutSet[]>([]);
    const [date, setDate] = useState(new Date(Date.now()));
    let dispatchAddSetToTraining = useDispatchAddSetToTraining();
    const theme = useTheme();
    return (
        <ScrollView style={{backgroundColor: theme.colors.background}} keyboardShouldPersistTaps='handled'>
            <DatePicker date={date} setDate={setDate}/>
            <Text style={{alignSelf: 'center'}}> Set {sets.length + 1}</Text>
            <AddWorkoutSet onSubmit={
                (workoutSet) => setSets([...sets, workoutSet])}/>
            <WorkoutSetView sets={sets}
                            onDelete={(workoutSet) => setSets([...sets.filter(value => value.id!! !== workoutSet.id!!)])}
                            onSubmit={(workoutSet) => setSets([...sets.map(value => value.id!! === workoutSet.id!! ? workoutSet : value)])}/>
            <Button
                onPress={() => {
                    dispatchAddSetToTraining({
                        sets: sets,
                        notes: '',
                        exerciseId: props.route.params.exercise.id!!,
                        start: date,
                        end: date
                    });
                    props.navigation.navigate({name: 'Exercises', params: undefined});
                }}>
                Add Workout
            </Button>
        </ScrollView>
    );
};


export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AddWorkoutTab;
