import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export interface ExerciseWorkoutSummary {
  lastWorkoutEnd: Date | undefined;
  totalFinishedWorkouts: number;
}

const EMPTY: ExerciseWorkoutSummary = {lastWorkoutEnd: undefined, totalFinishedWorkouts: 0};

// Aggregates how often (and how recently) an exercise was performed in
// FINISHED workouts. Drives the three header summary cards on the exercise
// detail screen and the "last done" cell on the exercise list rows.
export const useExerciseWorkoutSummary = (exerciseId: number | undefined): ExerciseWorkoutSummary =>
  useSelector((state: GlobalState) => {
    if (exerciseId === undefined) return EMPTY;
    const ids = state.workouts.byExerciseId?.[exerciseId];
    if (!ids || ids.length === 0) return EMPTY;
    let total = 0;
    let latest: Date | undefined;
    for (let i = ids.length - 1; i >= 0; i--) {
      const w = state.workouts.byId[ids[i]];
      if (!w || w.end === undefined) continue;
      total++;
      const end = new Date(w.end);
      if (!latest || end.getTime() > latest.getTime()) latest = end;
    }
    if (total === 0) return EMPTY;
    return {lastWorkoutEnd: latest, totalFinishedWorkouts: total};
  });
