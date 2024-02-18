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

