import {ScrollView} from "react-native";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import React from "react";
import {useExercise} from "../../redux/Exercises/useExercise";
import {Card, Text} from "react-native-paper";
import {useWorkoutsByIds} from "../../redux/Workout/useWorkoutsByIds";
import {Workout} from "../../models/Workout";
import {Record} from "../../models/Exercise";
import {repetitionWeightByOneRm} from "../../utils/RepetitionMaxHelper";

const ExerciseStatisticsTabs = ({route}: Props) => {
    let exercise = useExercise(route.params.exercise.id!!);
    let currentOneRm = exercise?.records?.[Record.ONE_RM]?.[exercise.records[Record.ONE_RM].length - 1]?.value;
    let workoutIds = exercise?.records ? Object.values(exercise?.records).flatMap((record) => record.map((record) => record.workoutId)) : [];
    let workouts = useWorkoutsByIds(workoutIds);
    let map = exercise?.records ? new Map(Object.entries(exercise.records).map(([key, value]) => {
        return [key as string, value.map((record) =>
            workouts.find(work => work.id === record.workoutId)
        ) as Workout[]]
    })) : undefined;
    return (
        <ScrollView keyboardShouldPersistTaps={"handled"}>
            <Card style={{marginBottom: 10}}>
                <Card.Title title={"One RM records"}/>
                <Card.Content>
                    {map ? map.get(Record.ONE_RM)?.map(workout => (
                        <Text
                            key={workout?.id}>{workout?.start ? new Date(workout.start).toDateString() : null} {workout?.records?.[Record.ONE_RM]} kg</Text>
                    )) : <></>}</Card.Content>
            </Card>
            <Card>
                <Card.Title title={"Reps estimates basen on current 1RM"}/>
                <Card.Content>
                    {currentOneRm && [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((reps) => {
                        return <Text
                            key={reps}> {reps} reps
                            @ {repetitionWeightByOneRm(reps, 0, currentOneRm!!).toFixed(2)} kg</Text>
                    })}
                </Card.Content>
            </Card>
        </ScrollView>
    )
        ;
};


export type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseStatisticsTab'>;

export default ExerciseStatisticsTabs;
