import {ScrollView, View} from "react-native";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import React from "react";
import {useExercise} from "../../redux/Exercises/useExercise";
import {Text} from "react-native-paper";
import {useWorkoutsByIds} from "../../redux/Workout/useWorkoutsByIds";
import {Workout} from "../../models/Workout";

const RecordTab = ({navigation, route}: Props) => {
    let exercise = useExercise(route.params.exercise.id!!);
    let workoutIds = exercise?.records ? Object.values(exercise?.records).flatMap((record) => record.map((record) => record.workoutId)) : [];
    let workouts = useWorkoutsByIds(workoutIds);
    let map = exercise?.records ? new Map(Object.entries(exercise.records).map(([key, value]) => {
        return [key as string, value.map((record) =>
            workouts.find(work => work.id == record.workoutId)
        ) as Workout[]]
    })) : undefined;
    return (
        <ScrollView keyboardShouldPersistTaps={"handled"}>
            {map ? Array.from(map).map(([key, value]) => (
                <View key={key}>
                    <Text>{key}</Text>
                    {value.map((workout) => (
                        <Text
                            key={workout?.id + key}>{workout?.start ? new Date(workout.start).toDateString() : null} {workout?.records?.[key]}</Text>
                    ))}
                </View>
            )) : <></>}
        </ScrollView>
    );
};


export type Props = NativeStackScreenProps<RootStackParamList, 'RecordTab'>;

export default RecordTab;
