import {Metric} from "../components/Picker";
import {sumBy} from "lodash";
import {Comparison, WorkoutSetMap} from "../components/WorkoutSetOverview";

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

export function calculateMetricComparisons(workout: WorkoutSetMap) {
    let metricComparison = new Map<Metric, Comparison>();
    Object.values(Metric).forEach((metric) => {
        let current = calculateMetricValue(workout.currentWorkoutSets, metric)!!;
        let last = calculateMetricValue(workout.lastWorkoutSets ?? [], metric);
        let difference = last ? current - last : undefined;
        metricComparison.set(metric, {value: current, difference: difference});
    })
    return metricComparison;
}

