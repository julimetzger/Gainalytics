import {NormalizedState} from "./normalizedState";

export interface NormalizedWorkoutState<T> extends NormalizedState<T>{
    byExerciseId: { [exerciseId: number]: number[] }
    notFinishedWorkouts?: { [exerciseId: number]: number }
    suggestedWorkouts?: { [exerciseId: number]: Workout }
}
