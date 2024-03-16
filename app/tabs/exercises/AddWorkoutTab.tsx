import React from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import AddWorkout from "../../components/AddWorkout";
import {ScrollView} from "react-native";

const AddWorkoutTab = ({navigation, route}: Props) => {

    return (
        <ScrollView keyboardShouldPersistTaps={"handled"}>
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
