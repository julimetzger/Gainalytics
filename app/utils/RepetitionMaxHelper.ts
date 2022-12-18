export const repetitionMax = (...workoutSet: WorkoutSet[]) => {
    return Math.max(...workoutSet.map(value => value.weight*(1+(value.reps+value.rir)/30.0)))
}

