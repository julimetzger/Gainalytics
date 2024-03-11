import {Metric} from "../components/Picker";
import {sum, sumBy} from "lodash";
import {Comparison, WorkoutSetMap} from "../components/WorkoutSetOverview";
import {Muscles} from "../models/Muscles";

export const repetitionMax = (...workoutSet: WorkoutSet[]) => {
    let number = Math.max(...workoutSet.map(value => value.weight * repsCoefficient(value.reps + value.rir)));
    return number !== -Infinity ? number : undefined;
}

export const oneRepMaxForWorkouts = (...workout: Workout[]) => {
    return repetitionMax(...workout.flatMap(workout => workout.sets));
}

function repsCoefficient(reps: number) {
    if (reps === 1)
        return 1;
    else
        return 1 + (reps) / 30;
}

/*
export const repetitionWeight = (reps: number, rir: number, ...workoutSet: WorkoutSet[]) => {
    return repetitionMax(...workoutSet) / repsCoefficient(reps + rir)
}
*/

export const repetitionWeightByOneRm = (reps: number, rir: number, oneRm: number) => {
    return oneRm / repsCoefficient(reps + rir)
}


export function calculateMetricValue(sets: WorkoutSet[], metric: Metric) {
    const oneRm = repetitionMax(...sets)?.valueOf();
    switch (metric) {
        //TOOO percentage für volume, sets und reps berücksichtigen
        case Metric.ONE_RM:
            return oneRm;
        case Metric.VOLUME:
            return sumBy(sets, value => value.weight * value.reps);
        case Metric.MAX_INTENSITY:
            return oneRm ? Math.max(...sets.map(value => value.weight / oneRm)) * 100 : 100;
        case Metric.AVERAGE_INTENSITY:
            return oneRm ? sumBy(sets, value => value.weight) / sets.length / oneRm * 100 : 100;
        case Metric.SETS:
            return sets.length;
        case Metric.REPS:
            return sumBy(sets, value => value.reps);
    }
}

export function calculateMetricValueForMuscles(exerxiseWorkoutMap: Map<Exercise, WorkoutSet[]>, metric: Metric, muscle: Muscles) {
    let sets = Object.values(exerxiseWorkoutMap) as WorkoutSet[];
    const oneRm = repetitionMax(...sets)?.valueOf();
    switch (metric) {
        //TOOO percentage für volume, sets und reps berücksichtigen
        case Metric.ONE_RM:
            return oneRm;
        case Metric.VOLUME:
            return sum(Array.from(exerxiseWorkoutMap).map(([exercise, workoutSets]) =>
                sumBy(workoutSets, value => value.weight * value.reps * (exercise.muscles?.find(m => m.muscles === muscle).percent ?? 0))))
        case Metric.MAX_INTENSITY:
            return oneRm ? Math.max(...sets.map(value => value.weight / oneRm)) * 100 : 100;
        case Metric.AVERAGE_INTENSITY:
            return oneRm ? sumBy(sets, value => value.weight) / sets.length / oneRm * 100 : 100;
        case Metric.SETS:
            return sum(Array.from(exerxiseWorkoutMap)
                .map(([exercise, workoutSets]) =>
                    sumBy(workoutSets, value =>
                        (exercise.muscles?.find(m => m.muscles === muscle).percent ?? 0))));
        case Metric.REPS:
            return sum(Array.from(exerxiseWorkoutMap)
                .map(([exercise, workoutSets]) =>
                    sumBy(workoutSets, value => (exercise.muscles?.find(m => m.muscles === muscle).percent * value.reps ?? 0))));
    }
}

export function calculateMetricComparisons(workout: WorkoutSetMap): Map<Metric, Comparison> {
    let metricComparison = new Map<Metric, Comparison>();
    Object.values(Metric).forEach((metric) => {
        let current = calculateMetricValue(workout.currentWorkoutSets, metric)!!;
        let last = (workout.lastWorkoutSets?.length ?? 0) > 0 ?
            calculateMetricValue(workout.lastWorkoutSets ?? [], metric) : undefined;
        let difference = last ? current - last : undefined;
        metricComparison.set(metric, {value: current, difference: difference});
    })
    return metricComparison;
}

export function calculateMetricComparisonsForMuscle(workout: Map<Exercise, WorkoutSetMap>, muscle: Muscles): Map<Metric, Comparison> {
    let exerciseWorkoutMap: ExerciseWorkoutSetMap = {
        currentWorkoutSets: new Map<Exercise, WorkoutSet[]>(),
        lastWorkoutSets: new Map<Exercise, WorkoutSet[]>()
    };
    Array.from(workout).forEach(([exercise, workoutSetMap]) => {
        exerciseWorkoutMap.currentWorkoutSets.set(exercise, workoutSetMap.currentWorkoutSets);
        exerciseWorkoutMap?.lastWorkoutSets?.set(exercise, workoutSetMap.lastWorkoutSets ?? []);
    })
    let metricComparison = new Map<Metric, Comparison>();
    Object.values(Metric).forEach((metric) => {
        let current = calculateMetricValueForMuscles(exerciseWorkoutMap.currentWorkoutSets, metric, muscle)!!;
        let last = (exerciseWorkoutMap.lastWorkoutSets?.size ?? 0) > 0 ?
            calculateMetricValueForMuscles(exerciseWorkoutMap.lastWorkoutSets ?? new Map(), metric, muscle) : undefined;
        let difference = last ? current - last : undefined;
        metricComparison.set(metric, {value: current, difference: difference});
    })
    return metricComparison;
}

export interface WorkoutSetMap {
    currentWorkoutSets: WorkoutSet[],
    lastWorkoutSets?: WorkoutSet[]
}

export interface ExerciseWorkoutSetMap {
    currentWorkoutSets: Map<Exercise, WorkoutSet[]>,
    lastWorkoutSets?: Map<Exercise, WorkoutSet[]>
}

