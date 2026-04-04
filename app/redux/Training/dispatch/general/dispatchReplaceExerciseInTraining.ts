import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {Workout} from '../../../../models/entities/Workout';

export const dispatchReplaceExerciseInTraining = () => {
  const dispatch = useDispatch();

  return (trainingsId: number, fromExerciseId: number, toExerciseId: number, plannedWorkout?: Workout, doneWorkout?: Workout) =>
    dispatch({
      type: 'REPLACE_EXERCISE_IN_TRAINING',
      trainingsId,
      fromExerciseId,
      toExerciseId,
      plannedWorkout,
      doneWorkout,
    } as Action);
};
