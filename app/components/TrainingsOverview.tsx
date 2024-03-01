import {ScrollView, View} from "react-native";
import {Card, DataTable, List, Text} from "react-native-paper";
import React from "react";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {useExercise} from "../redux/Exercises/useExercise";
import {calculateMetricValue} from "../utils/RepetitionMaxHelper";
import {Metric} from "./Picker";
import {Muscles} from "../models/Muscles";
import {sumBy} from "lodash";
import {MusclePercentPair} from "./MusclePicker";
import {useLastTrainingInMicro} from "../redux/Training/useLastTrainingInMicro";

interface TrainingsOverviewProps {
    training: Training,
    previousTraining: Training
}

const TrainingsOverview = ({training, previousTraining}: TrainingsOverviewProps) => {
    let exerciseWorkoutMap = new Map<Exercise, Workout>();
    let usedMuscles = new Map<Muscles, WorkoutSet[]>

    Object.entries(training.doneWorkoutIds).forEach(([exerciseId, wokoutId]) => {
        let workout = useWorkoutById(wokoutId);
        let exercise = useExercise(parseInt(exerciseId));
        if (workout && exercise) {
            exerciseWorkoutMap.set(exercise, workout);
        }
        exercise?.muscles?.forEach((muscle: MusclePercentPair) => {
            if (muscle.muscle) {
                if (usedMuscles.has(muscle.muscle)) {
                    usedMuscles.get(muscle.muscle)?.push(...workout.sets);
                } else {
                    usedMuscles.set(muscle.muscle, [...workout.sets]);
                }
            }
        })
    })

    return (
        <ScrollView>
            <View><Text>Training completed, Markus approves. Heim gehen und gains abholen. Der
                Thunfischshake
                wartet
                auf dich! </Text>
                <Card>
                    <Card.Title title={<Text>Total Duration</Text>}></Card.Title>
                    <Card.Content>
                        <Text>{new Date(new Date(training.end!!).getTime() - new Date(training.start!!).getTime()).toISOString().substring(11, 19)}</Text>
                    </Card.Content>
                </Card>
                <Card>
                    <Card.Title title={<Text>Exercise Overview</Text>}></Card.Title>
                    <Card.Content>
                        <DataTable>
                            <DataTable.Header>
                                <DataTable.Title>Exercise</DataTable.Title>
                                <DataTable.Title numeric>1RM</DataTable.Title>
                                <DataTable.Title numeric>Reps</DataTable.Title>
                                <DataTable.Title numeric>Max Intensity</DataTable.Title>
                            </DataTable.Header>

                            {Array.from(exerciseWorkoutMap).map(([exercise, workout]) => {
                                return <DataTable.Row key={exercise.id}>
                                    <DataTable.Cell>{exercise.name}</DataTable.Cell>
                                    <DataTable.Cell>{calculateMetricValue(workout.sets, Metric.ONE_RM)?.toFixed(2)}</DataTable.Cell>
                                    <DataTable.Cell>{sumBy(workout.sets, (value) => value.reps)}</DataTable.Cell>
                                    <DataTable.Cell>{calculateMetricValue(workout.sets, Metric.MAX_INTENSITY)?.toFixed(2)}</DataTable.Cell>
                                </DataTable.Row>
                            })}
                        </DataTable>
                    </Card.Content>
                </Card>
                <Card>
                    <Card.Title title={<Text>Muscle Overview</Text>}></Card.Title>
                    <Card.Content>
                        <DataTable>
                            <DataTable.Header>
                                <DataTable.Title>Exercise</DataTable.Title>
                                <DataTable.Title numeric>Volume</DataTable.Title>
                                <DataTable.Title numeric>Sets</DataTable.Title>
                                <DataTable.Title numeric>Reps</DataTable.Title>
                            </DataTable.Header>
                            {Array.from(usedMuscles).map(([muscle, workout]) => {
                                return <DataTable.Row key={muscle.toString()}>
                                    <DataTable.Cell>{muscle}</DataTable.Cell>
                                    <DataTable.Cell>{calculateMetricValue(workout, Metric.VOLUME)}</DataTable.Cell>
                                    <DataTable.Cell>{workout.length}</DataTable.Cell>
                                    <DataTable.Cell>{sumBy(workout, (value) => value.reps)}</DataTable.Cell>
                                </DataTable.Row>
                            })}
                        </DataTable>
                    </Card.Content>
                </Card>
            </View>
        </ScrollView>
    );
}

export default TrainingsOverview;
