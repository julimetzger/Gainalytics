export const repetitionMax = (...workoutSet: WorkoutSet[]) => {
    let number = Math.max(...workoutSet.map(value => value.weight * repsCofficient(value.reps + value.rir)));
    return number !== -Infinity ? number : undefined;
}

export const oneRepMaxForWorkouts = (...workout: Workout[]) => {
    return repetitionMax(...workout.flatMap(workout => workout.sets));
}

function repsCofficient(reps: number) {
    if (reps === 1)
        return 1;
    else
        return 1 + (reps) / 30;
}

/*
export const repetionWeight = (reps: number, rir: number, ...workoutSet: WorkoutSet[]) => {
    return repetitionMax(...workoutSet) / repsCofficient(reps + rir)
}
*/

export const repetionWeightByOneRm = (reps: number, rir: number, oneRm: number) => {
    return oneRm / repsCofficient(reps + rir)
}

