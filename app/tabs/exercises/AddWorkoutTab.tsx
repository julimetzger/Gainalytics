import React, { useState } from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import AddWorkout from "../../components/AddWorkout";
import {ScrollView, View} from "react-native";
import {Button} from "react-native-paper";
import DatePicker from '../../components/DatePicker';

const AddWorkoutTab = ({navigation, route}: Props) => {
    let exercise = route.params.exercise;
    const [date, setDate] = useState(new Date(Date.now()));


    return (
        <ScrollView keyboardShouldPersistTaps={"handled"}>
            <View style={{flexDirection: 'row', justifyContent:'space-around'}}>
                <Button onPress={() =>
                    navigation.navigate({
                        name: 'ExerciseStatisticsTab',
                        params: {exercise},
                    })}
                >Stats</Button>
                <DatePicker date={date} setDate={setDate}/>
                <Button onPress={() =>
                    navigation.navigate({
                        name: 'ExericseHistory',
                        params: {exercise},
                    })}
                >History</Button>
            </View>
            <AddWorkout exercise={route.params.exercise}
                        onSubmit={() => navigation.navigate({name: 'Exercises', params: undefined})}
                        suggest date={date}/>
        </ScrollView>
    );
};


export type Props = NativeStackScreenProps<RootStackParamList, 'AddWorkoutTab'>;

export default AddWorkoutTab;
