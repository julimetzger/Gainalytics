import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/entities/Workout';

export const useWorkoutsByExerciseId = (exerciseId: number | undefined): Workout[] =>
  useSelector((state: GlobalState) => {
    if (exerciseId === undefined) return [] as Workout[];
    const ids = state.workouts.byExerciseId?.[exerciseId];
    if (!ids || ids.length === 0) return [] as Workout[];
    return ids
      .map((id) => state.workouts.byId[id])
      .filter((w): w is Workout => w !== undefined);
  });
