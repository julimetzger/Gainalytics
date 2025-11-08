import { ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../routing/exerciseRouter";
import React from "react";
import { useExercise } from "../../redux/Exercises/useExercise";
import { Card, Text } from "react-native-paper";
import { useWorkoutsByIds } from "../../redux/Workout/useWorkoutsByIds";
import { Workout } from "../../models/Workout";
import { Record } from "../../models/Exercise";
import { repetitionWeightByOneRm } from "../../utils/AnalyseUtils";

const ExerciseStatisticsTabs = ({ route }: Props) => {
    let exercise = useExercise(route.params.exercise.id!!);
    let currentOneRm = exercise?.records?.[Record.ONE_RM]?.[exercise.records[Record.ONE_RM].length - 1]?.value;
    let workoutIds = exercise?.records ? Object.values(exercise?.records).flatMap((record) => record.map((record) => record.workoutId)) : [];
    let workouts = useWorkoutsByIds(workoutIds);
    let map = exercise?.records ? new Map(Object.entries(exercise.records).map(([key, value]) => {
        return [key as string, value.map((record) =>
            workouts.find(work => work.id === record.workoutId)
        ) as Workout[]];
    })) : undefined;

    return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps={"handled"}>
            <Card style={styles.card}>
                <Card.Title title="Rep Estimates Based on Current 1RM" titleStyle={styles.cardTitle}
                            titleNumberOfLines={2}/>
                <Card.Content>
                    {currentOneRm ? (
                        [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((reps) => (
                            <Text key={reps} style={styles.text}>
                                {reps} reps @ {repetitionWeightByOneRm(reps, 0, currentOneRm!!).toFixed(2)} kg
                            </Text>
                        ))
                    ) : (
                        <Text style={styles.text}>No current 1RM data available.</Text>
                    )}
                </Card.Content>
            </Card>

            <Card style={styles.card}>
                <Card.Title title="One RM Records" titleStyle={styles.cardTitle} />
                <Card.Content>
                    {map && map.get(Record.ONE_RM) ? (
                        map.get(Record.ONE_RM)
                            .filter((workout, index, self) => {
                                const weight = workout.records?.[Record.ONE_RM];
                                const date = workout.start ? new Date(workout.start).toDateString() : null;
                                return self.findIndex((w) => {
                                    const otherWeight = w.records?.[Record.ONE_RM];
                                    const otherDate = w.start ? new Date(w.start).toDateString() : null;
                                    return weight === otherWeight && date === otherDate;
                                }) === index;
                            })
                            .sort((a, b) => {
                                const oneRmA = a.records?.[Record.ONE_RM] ?? 0;
                                const oneRmB = b.records?.[Record.ONE_RM] ?? 0;
                                return oneRmB - oneRmA;
                            })
                            .map((workout) => (
                                <View key={workout.id}>
                                    <Text style={styles.text}>
                                        {workout.start ? new Date(workout.start).toDateString() : "Unknown Date"} - {workout.records?.[Record.ONE_RM]?.toFixed(2)} kg
                                    </Text>
                                </View>
                            ))
                    ) : (
                        <Text style={styles.text}>No records found.</Text>
                    )}
                </Card.Content>
            </Card>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 10,
    },
    card: {
        marginBottom: 15,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    text: {
        fontSize: 16,
        marginVertical: 5,
    },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseStatisticsTab'>;

export default ExerciseStatisticsTabs;
