import {ScrollView, View} from "react-native";
import {Card, DataTable, Text} from "react-native-paper";
import React from "react";
import {useWorkoutById} from "../redux/Workout/useWorkoutById";
import {useExercise} from "../redux/Exercises/useExercise";
import {calculateMetricValue} from "../utils/RepetitionMaxHelper";
import {Metric} from "./Picker";
import {Muscles} from "../models/Muscles";
import {MusclePercentPair} from "./MusclePicker";
import {useWorkoutsByIds} from "../redux/Workout/useWorkoutsByIds";
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";

interface TrainingsOverviewProps {
    training: Training,
    previousTraining: Training
}

interface WorkoutSetMap {
    currentWorkoutSets: WorkoutSet[],
    lastWorkoutSets?: WorkoutSet[]
}

interface Comparison {
    value: number,
    difference?: number
}

function MetricView(comparison: Comparison) {
    const greater = comparison.difference!! >= 0;
    return <View style={{display: 'flex', alignItems: 'flex-end'}}>
        {comparison?.difference !== undefined &&
            <Text
                style={{color: greater ? '#558b2f' : '#b22222'}}>
                {(greater ? "+" : "") + comparison.difference!!.toFixed(2)}
            </Text>
        }
        <Text>{comparison?.value?.toFixed(2)}</Text>
    </View>;
}

const TrainingsOverview = ({training, previousTraining}: TrainingsOverviewProps) => {
    let trainingsWorkouts = useWorkoutsByIds(Object.values(training.doneWorkoutIds));
    let trainingExcercises = useExerciseByIds(trainingsWorkouts.map((workout: Workout) => workout.exerciseId));
    let previousWorkouts = useWorkoutsByIds(previousTraining ? Object.values(previousTraining.doneWorkoutIds) : []);

    let exerciseWorkoutMap = new Map<Exercise, WorkoutSetMap>();
    let usedMuscles = new Map<Muscles, WorkoutSetMap>;
    trainingsWorkouts.forEach(workout => {
        let exercise = trainingExcercises.find((exercise: Exercise) => exercise.id === workout.exerciseId);
        let lastWorkout = previousWorkouts.filter((previousWorkout: Workout) => previousWorkout.exerciseId === workout.exerciseId);
        if (workout && exercise) {
            if (exerciseWorkoutMap.get(exercise)) {
                exerciseWorkoutMap.get(exercise)?.currentWorkoutSets.push(...workout.sets);
                lastWorkout ? exerciseWorkoutMap.get(exercise)?.lastWorkoutSets?.push(...lastWorkout?.map((workout: Workout) => workout.sets).flat()) : 0;
            } else {
                exerciseWorkoutMap.set(exercise, {
                    currentWorkoutSets: workout.sets,
                    lastWorkoutSets: lastWorkout?.map((workout: Workout) => workout.sets).flat() ?? []
                });
            }
        }
        exercise?.muscles?.forEach((muscle: MusclePercentPair) => {
            if (muscle.muscle) {
                //TODO lastWorkoutSets handling genauer
                if (usedMuscles.has(muscle.muscle)) {
                    usedMuscles.get(muscle.muscle)?.currentWorkoutSets?.push(...workout.sets);
                    lastWorkout ? usedMuscles.get(muscle.muscle)?.lastWorkoutSets?.push(...lastWorkout?.map((workout: Workout) => workout.sets).flat()) : 0;
                } else {
                    usedMuscles.set(muscle.muscle, {
                        currentWorkoutSets: workout?.sets ? [...workout.sets] : [],
                        lastWorkoutSets: lastWorkout?.map((workout: Workout) => workout.sets).flat() ?? []
                    });
                }
            }
        })
    })

    let exerciseMetricMap = new Map<Exercise, Map<Metric, Comparison>>();

    Array.from(exerciseWorkoutMap).forEach(([exercise, workout]) => {
            let metricComparison = new Map<Metric, Comparison>();
            Object.values(Metric).forEach((metric) => {
                let current = calculateMetricValue(workout.currentWorkoutSets, metric)!!;
                let last = calculateMetricValue(workout.lastWorkoutSets ?? [], metric);
                let difference = last ? current - last : undefined;
                metricComparison.set(metric, {value: current, difference: difference});
            })
            exerciseMetricMap.set(exercise, metricComparison);
        }
    )

    let muscleMetricMap = new Map<Muscles, Map<Metric, Comparison>>();

    Array.from(usedMuscles).forEach(([muscle, workout]) => {
            let metricComparison = new Map<Metric, Comparison>();
            Object.values(Metric).forEach((metric) => {
                let current = calculateMetricValue(workout.currentWorkoutSets, metric)!!;
                let last = calculateMetricValue(workout.lastWorkoutSets ?? [], metric);
                let difference = last ? current - last : undefined;
                metricComparison.set(metric, {value: current, difference: difference});
            })
            muscleMetricMap.set(muscle, metricComparison);
        }
    )

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
                            {Array.from(exerciseMetricMap).map(([exercise, workout]) => {
                                return <DataTable.Row key={exercise.id}>
                                    <DataTable.Cell>{exercise.name}</DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        {MetricView(workout.get(Metric.ONE_RM)!!)}
                                    </DataTable.Cell>
                                    <DataTable.Cell
                                        numeric>{MetricView(workout.get(Metric.REPS)!!)}</DataTable.Cell>
                                    <DataTable.Cell
                                        numeric>{MetricView(workout.get(Metric.MAX_INTENSITY)!!)}</DataTable.Cell>
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
                            {Array.from(muscleMetricMap).map(([muscle, workout]) => {
                                return <DataTable.Row key={muscle.toString()}>
                                    <DataTable.Cell>{muscle}</DataTable.Cell>
                                    <DataTable.Cell
                                        numeric>{MetricView(workout.get(Metric.VOLUME)!!)}</DataTable.Cell>
                                    <DataTable.Cell
                                        numeric>{MetricView(workout.get(Metric.SETS)!!)}</DataTable.Cell>
                                    <DataTable.Cell
                                        numeric>{MetricView(workout.get(Metric.REPS)!!)}</DataTable.Cell>
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
