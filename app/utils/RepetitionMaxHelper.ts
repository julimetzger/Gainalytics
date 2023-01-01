export const repetitionMax = (...workoutSet: WorkoutSet[]) => {
    let number = Math.max(...workoutSet.map(value => value.weight * (1 + (value.reps + value.rir) / 30.0)));
    return number !== -Infinity ? number : null;
}

export const oneRepMaxForWorkouts = (...workout: Workout[]) => {
    return repetitionMax(...workout.flatMap(workout => workout.sets));
}

function repsCofficient(reps: number) {
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

