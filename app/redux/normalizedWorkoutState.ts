import {NormalizedState} from "./normalizedState";

export interface NormalizedWorkoutState<T> extends NormalizedState<T> {
    byExerciseId: { [exerciseId: number]: number[] }
    notFinishedWorkouts?: { [exerciseId: number]: number }
    suggestedWorkouts?: { [exerciseId: number]: Workout }
    plannedWorkouts: number[]
}

export function determineNewWorkoutId<T extends any>(normalizedState: NormalizedWorkoutState<T>) {
    if (normalizedState.allIds.length > 0 || normalizedState.plannedWorkouts?.length > 0)
        return Math.max(...normalizedState.allIds, ...normalizedState.plannedWorkouts) + 1;
    else
        return 1;
}

