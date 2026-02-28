import {NormalizedState} from './normalizedState';
import {Workout} from '../models/entities/Workout';

export interface NormalizedWorkoutState<T> extends NormalizedState<T> {
  byExerciseId: {[exerciseId: number]: number[]};
  notFinishedWorkouts?: {[exerciseId: number]: number};
  suggestedWorkouts?: {[exerciseId: number]: Workout};
  plannedWorkouts: number[];
}

export function determineNewWorkoutId<T extends any>(normalizedState: NormalizedWorkoutState<T>) {
  const workoutIds = [
    ...normalizedState.allIds,
    ...(normalizedState.plannedWorkouts ?? []),
    ...Object.keys(normalizedState.byId)
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id)),
  ];
  if (workoutIds.length > 0) return Math.max(...workoutIds) + 1;
  return 1;
}
