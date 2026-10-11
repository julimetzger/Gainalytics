import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {oneRepMaxForWorkouts} from '../../../utils/AnalyseUtils';
import {Workout} from '../../../models/entities/Workout';

export const selectAllTimeOneRepMax = (state: GlobalState, exerciseId?: number): number => {
  if (exerciseId === undefined) return 0;
  const workoutIds = state.workouts.byExerciseId?.[exerciseId];
  if (!workoutIds || workoutIds.length === 0) return 0;
  const workouts = workoutIds
    .map((id) => state.workouts.byId[id])
    .filter((w): w is Workout => w !== undefined && (w as any).end !== undefined);
  if (workouts.length === 0) return 0;
  return oneRepMaxForWorkouts(...workouts);
};

export const useAllTimeOneRepMax = (exerciseId?: number): number => {
  return useSelector((state: GlobalState) => selectAllTimeOneRepMax(state, exerciseId));
};
