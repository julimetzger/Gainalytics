import {Metric} from "../picker/elements/TrainingElementPicker";
import {
    calculateMetricComparisons,
    calculateMetricComparisonsForMuscle,
    calculateMetricValue,
    WorkoutSetMap
} from "../../utils/AnalyseUtils";
import {Card, DataTable, Dialog, Portal, Text} from "react-native-paper";
import React, {useState} from "react";
import {useExerciseByIds} from "../../redux/Exercises/useExerciseByIds";
import MetricView from "./MetricComparison";
import {Muscles} from "../../models/Muscles";
import {Exercise, MusclePercentPair} from "../../models/Exercise";
import {Workout} from "../../models/Workout";
import {StyleSheet} from "react-native";
import ExerciseMetricOverview from "../exercise/show/ExerciseMetricOverview";

export interface Comparison {
    value: number,
    difference?: number
}

interface WorkoutSetOverviewProps {
    trainingsWorkouts: Workout[],
    previousWorkouts?: Workout[],
    showExercises?: boolean
}

interface MuscleDetails {
    muscle: Muscles,
    metric: Metric
}

const MetricsOverviewForWorkouts = ({
                                trainingsWorkouts,
                                previousWorkouts = [],
                                showExercises = true
                            }: WorkoutSetOverviewProps) => {
    let trainingExcercises = useExerciseByIds([...trainingsWorkouts].map((workout: Workout) => workout.exerciseId));
    let previousExercises = useExerciseByIds([...previousWorkouts].map((workout: Workout) => workout.exerciseId));
    const [seledtedMuscle, setSelectedMuscle] = useState<MuscleDetails | undefined>(undefined)

    let exerciseWorkoutMap = new Map<Exercise, WorkoutSetMap>();
    [...trainingExcercises, ...previousExercises].forEach(exercise => {
        exerciseWorkoutMap.set(exercise, {
            currentWorkoutSets: trainingsWorkouts.filter((workout: Workout) => workout.exerciseId === exercise.id).flatMap((workout: Workout) => workout.sets),
            lastWorkoutSets: previousWorkouts.filter((workout: Workout) => workout.exerciseId === exercise.id).flatMap((workout: Workout) => workout.sets)
        });
    });
    let exerciseMetricMap = new Map<Exercise, Map<Metric, Comparison>>();

    Array.from(exerciseWorkoutMap).forEach(([exercise, workout]) => {
            let metricComparison = calculateMetricComparisons(workout);
            exerciseMetricMap.set(exercise, metricComparison);
        }
    );
    let muscleMetricMap = calculateMetricComparisonsForMuscle(exerciseWorkoutMap);

    return <>
        {showExercises && <ExerciseMetricOverview exerciseMetricMap={exerciseMetricMap}/>}
        <Card style={{margin: 5}}>
            <Card.Title title={<Text>Muscle Overview</Text>}></Card.Title>
            <Card.Content>
                <DataTable>
                    <DataTable.Header>
                        <DataTable.Title style={styles.flexL}>Exercise</DataTable.Title>
                        <DataTable.Title style={styles.flexM} numeric>Volume</DataTable.Title>
                        <DataTable.Title style={styles.flexS} numeric>Sets</DataTable.Title>
                        <DataTable.Title style={styles.flexS} numeric>Reps</DataTable.Title>
                    </DataTable.Header>
                    {Array.from(muscleMetricMap).sort(([muscleA], [muscleB]) => {
                            return muscleA.localeCompare(muscleB);
                    }).map(([muscle, workout]) => {
                        return <DataTable.Row key={muscle.toString()}>
                            <DataTable.Cell style={styles.flexL}>{muscle}</DataTable.Cell>
                            <DataTable.Cell style={styles.flexM} numeric onPress={() => setSelectedMuscle({
                                muscle: muscle,
                                metric: Metric.VOLUME
                            })}>
                                <MetricView comparison={workout.get(Metric.VOLUME)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell style={styles.flexS} numeric onPress={() => setSelectedMuscle({
                                muscle: muscle,
                                metric: Metric.SETS
                            })}>
                                <MetricView comparison={workout.get(Metric.SETS)!!}/>
                            </DataTable.Cell>
                            <DataTable.Cell style={styles.flexS} numeric onPress={() => setSelectedMuscle({
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
                <Dialog.Content>
                    <DataTable>
                        <DataTable.Header>
                            <DataTable.Title style={styles.flexL}>Exercise</DataTable.Title>
                            <DataTable.Title style={styles.flexM} numeric>Value</DataTable.Title>
                            <DataTable.Title style={styles.flexS} numeric>Factor</DataTable.Title>
                            <DataTable.Title style={styles.flexS} numeric>Result</DataTable.Title>
                        </DataTable.Header>
                        {Array.from(exerciseWorkoutMap).map(([exercise, workout]) => {
                            let matchedExercise = exercise.muscles?.find((muscle) => muscle.muscle === seledtedMuscle?.muscle) as MusclePercentPair | undefined;
                            if (matchedExercise) {
                                let unmodifiedMetricValue = calculateMetricValue(workout.currentWorkoutSets, seledtedMuscle!!.metric);
                                let percent = [Metric.SETS, Metric.VOLUME, Metric.REPS].includes(seledtedMuscle?.metric!!) ? matchedExercise.percent : 100;
                                return (
                                    <DataTable.Row>
                                        <DataTable.Cell
                                            style={styles.flexL}><Text>{exercise.name}</Text></DataTable.Cell>
                                        <DataTable.Cell style={styles.flexM}
                                                        numeric>{unmodifiedMetricValue}</DataTable.Cell>
                                        <DataTable.Cell style={styles.flexS} numeric>{percent}</DataTable.Cell>
                                        <DataTable.Cell style={styles.flexS}
                                                        numeric>{unmodifiedMetricValue!! * percent!! / 100}</DataTable.Cell>
                                    </DataTable.Row>
                                )
                            }
                        })}
                    </DataTable>
                </Dialog.Content>
            </Dialog>
        </Portal>
    </>
}

let styles = StyleSheet.create({
    flexL: {
        flex: 10,
    },
    flexM: {
        flex: 7,
    },
    flexS: {
        flex: 6,
    },
});
export default MetricsOverviewForWorkouts;
