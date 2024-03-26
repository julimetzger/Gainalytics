import React from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import AddWorkout from "../../components/AddWorkout";
import {ScrollView} from "react-native";
import {Button} from "react-native-paper";

const AddWorkoutTab = ({navigation, route}: Props) => {
    let exercise = route.params.exercise;

    return (
        <ScrollView keyboardShouldPersistTaps={"handled"}>
            <Button onPress={() =>
                navigation.navigate({
                    name: 'RecordTab',
                    params: {exercise},
                })}
            >Records</Button>
            <AddWorkout exercise={route.params.exercise}
                        onSubmit={() => navigation.navigate({name: 'Exercises', params: undefined})}
                        historyCallback={(start) => navigation.navigate('History', {
                            screen: 'History',
                            params: {exercise: route.params.exercise, lowerRangeBound: start}
                        })}
                        suggest/>
        </ScrollView>
    );
};


export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AddWorkoutTab;
