import {Metric} from "./Picker";
import {
    calculateMetricComparisons,
    calculateMetricComparisonsForMuscle, calculateMetricValue,
    WorkoutSetMap
} from "../utils/RepetitionMaxHelper";
import {Card, DataTable, Dialog, Portal, Text} from "react-native-paper";
import React, {useState} from "react";
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";
import MetricView from "./MetricComparison";
import {Muscles} from "../models/Muscles";
import {MusclePercentPair} from "./MusclePicker";

export interface Comparison {
    value: number,
    difference?: number
}

interface WorkoutSetOverviewProps {
    trainingsWorkouts: Workout[],
    previousWorkouts?: Workout[]
}

interface MuscleDetails {
    muscle: Muscles,
    metric: Metric
}

const WorkoutSetOverview = ({trainingsWorkouts, previousWorkouts = []}: WorkoutSetOverviewProps) => {
    let trainingExcercises = useExerciseByIds(trainingsWorkouts.map((workout: Workout) => workout.exerciseId));
    const [seledtedMuscle, setSelectedMuscle] = useState<MuscleDetails | undefined>(undefined)

    let exerciseWorkoutMap = new Map<Exercise, WorkoutSetMap>();
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
    })

    let exerciseMetricMap = new Map<Exercise, Map<Metric, Comparison>>();

    Array.from(exerciseWorkoutMap).forEach(([exercise, workout]) => {
            let metricComparison = calculateMetricComparisons(workout);
            exerciseMetricMap.set(exercise, metricComparison);
        }
    )

    let muscleMetricMap = calculateMetricComparisonsForMuscle(exerciseWorkoutMap);

    return <>
        <Card style={{margin: 5}}>
            <Card.Title title={<Text>Exercise Overview</Text>}></Card.Title>
            <Card.Content>
                <DataTable>
                    <DataTable.Header>
                        <DataTable.Title>Exercise</DataTable.Title>
                        <DataTable.Title numeric>1RM</DataTable.Title>
                        <DataTable.Title numeric>Reps</DataTable.Title>
                        <DataTable.Title numeric numberOfLines={2}>Max Intensity</DataTable.Title>
                    </DataTable.Header>
                    {Array.from(exerciseMetricMap).map(([exercise, workout]) => {
                        return <DataTable.Row key={exercise.id}>
                            <DataTable.Cell>
                                <Text>{exercise.name}</Text>
                            </DataTable.Cell>
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
                            <DataTable.Cell numeric onLongPress={() => setSelectedMuscle({
                                muscle: muscle,
                                metric: Metric.VOLUME
                            })}>
                                <MetricView comparison={workout.get(Metric.VOLUME)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell numeric onLongPress={() => setSelectedMuscle({
                                muscle: muscle,
                                metric: Metric.SETS
                            })}>
                                <MetricView comparison={workout.get(Metric.SETS)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell numeric onLongPress={() => setSelectedMuscle({
                                muscle: muscle,
                                metric: Metric.REPS
                            })}>
                                <MetricView comparison={workout.get(Metric.REPS)!!}/>
                            </DataTable.Cell>
                        </DataTable.Row>
                    })}
                </DataTable>
            </Card.Content>
        </Card>
        <Portal>
            <Dialog visible={seledtedMuscle !== undefined} onDismiss={() => setSelectedMuscle(undefined)}>
                <Dialog.Title>{seledtedMuscle?.muscle + " " + seledtedMuscle?.metric + " Contribution"}</Dialog.Title>
                <DataTable.Header>
                    <DataTable.Title>Exercise</DataTable.Title>
                    <DataTable.Title numeric>Value</DataTable.Title>
                    <DataTable.Title numeric>Factor</DataTable.Title>
                    <DataTable.Title numeric>Contribution</DataTable.Title>
                </DataTable.Header>
                <Dialog.Content>
                    {Array.from(exerciseWorkoutMap).map(([exercise, workout]) => {

                        let matchedExercise = exercise.muscles?.find((muscle) => muscle.muscle === seledtedMuscle?.muscle) as MusclePercentPair | undefined;
                        if (matchedExercise) {
                            let unmodifiedMetricValue = calculateMetricValue(workout.currentWorkoutSets, seledtedMuscle!!.metric);
                            let percent = [Metric.SETS, Metric.VOLUME, Metric.REPS].includes(seledtedMuscle?.metric!!) ? matchedExercise.percent : 100;
                            return (
                                <DataTable.Row>
                                    <DataTable.Title>{exercise.name}</DataTable.Title>
                                    <DataTable.Title
                                        numeric>{unmodifiedMetricValue}</DataTable.Title>
                                    <DataTable.Title
                                        numeric>{percent}</DataTable.Title>
                                    <DataTable.Title
                                        numeric>{unmodifiedMetricValue!! * percent!! / 100}</DataTable.Title>
                                </DataTable.Row>)
                        }
                    })}
                </Dialog.Content>
            </Dialog>
        </Portal>
    </>
        ;
}

export default WorkoutSetOverview;
