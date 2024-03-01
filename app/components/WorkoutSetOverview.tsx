import {Muscles} from "../models/Muscles";
import {MusclePercentPair} from "./MusclePicker";
import {Metric} from "./Picker";
import {calculateMetricComparisons, calculateMetricValue} from "../utils/RepetitionMaxHelper";
import {Card, DataTable, Text} from "react-native-paper";
import React from "react";
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import MetricView from "./MetricComparison";


export interface WorkoutSetMap {
    currentWorkoutSets: WorkoutSet[],
    lastWorkoutSets?: WorkoutSet[]
}

export interface Comparison {
    value: number,
    difference?: number
}


interface WorkoutSetOverviewProps {
    trainingsWorkouts: Workout[],
    previousWorkouts?: Workout[]
}

const WorkoutSetOverview = ({trainingsWorkouts, previousWorkouts = []}: WorkoutSetOverviewProps) => {
    let trainingExcercises = useExerciseByIds(trainingsWorkouts.map((workout: Workout) => workout.exerciseId));

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
            let metricComparison = calculateMetricComparisons(workout);
            muscleMetricMap.set(muscle, metricComparison);
        }
    )

    return <>
        <Card style={{margin: 5}}>
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
                                <MetricView comparison={workout.get(Metric.ONE_RM)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell numeric>
                                <MetricView comparison={workout.get(Metric.REPS)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell numeric>
                                <MetricView comparison={workout.get(Metric.MAX_INTENSITY)!!}/>
                            </DataTable.Cell>
                        </DataTable.Row>
                    })}
                </DataTable>
            </Card.Content>
        </Card>
        <Card style={{margin: 5}}>
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
                            <DataTable.Cell numeric>
                                <MetricView comparison={workout.get(Metric.VOLUME)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell numeric>
                                <MetricView comparison={workout.get(Metric.SETS)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell numeric>
                                <MetricView comparison={workout.get(Metric.REPS)!!}/>
                            </DataTable.Cell>
                        </DataTable.Row>
                    })}
                </DataTable>
            </Card.Content>
        </Card>
    </>;
}

export default WorkoutSetOverview;
