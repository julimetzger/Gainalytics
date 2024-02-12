import React from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import AddWorkout from "../../components/AddWorkout";

const AddWorkoutTab = ({navigation, route}: Props) => {

    return (
        <AddWorkout exercise={route.params.exercise}
                    onSubmit={() => navigation.navigate({name: 'Exercises', params: undefined})}
                    historyCallback={(start) => navigation.navigate('History', {
                        screen: 'History',
                        params: {exercise: route.params.exercise, lowerRangeBound: start}
                    })}
                    suggest/>

    );
};


export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AddWorkoutTab;
