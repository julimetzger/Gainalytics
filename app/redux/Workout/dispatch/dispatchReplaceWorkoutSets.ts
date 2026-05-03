import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';

export const dispatchReplaceWorkoutSets = () => {
  const dispatch = useDispatch();

  return (workoutId: number, sets: WorkoutSet[]) =>
    dispatch({
      type: 'REPLACE_WORKOUT_SETS',
      workoutId,
      sets,
    } as Action);
};
