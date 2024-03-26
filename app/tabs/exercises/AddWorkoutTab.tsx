import React from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import AddWorkout from "../../components/AddWorkout";
import {ScrollView, View} from "react-native";
import {Button} from "react-native-paper";

const AddWorkoutTab = ({navigation, route}: Props) => {
    let exercise = route.params.exercise;

    return (
        <ScrollView keyboardShouldPersistTaps={"handled"}>
            <View style={{display: 'flex', flexDirection: 'row', justifyContent:'space-evenly'}}>
                <Button onPress={() =>
                    navigation.navigate({
                        name: 'ExerciseStatisticsTab',
                        params: {exercise},
                    })}
                >Stats</Button>
                <Button onPress={() =>
                    navigation.navigate({
                        name: 'ExericseHistory',
                        params: {exercise},
                    })}
                >History</Button>
            </View>
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
