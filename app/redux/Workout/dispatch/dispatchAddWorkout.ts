import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {useNextWorkoutId} from '../use/useNextWorkoutId';
import {Workout} from '../../../models/Workout';
import {dispatchRecord} from './dispatchAddOrUpdateSetInWorkout';
import {Exercise} from '../../../models/Exercise';

/**
 * add fully build workout to redux store
 */
export const dispatchAddWorkout = (exercise: Exercise) => {
  const dispatch = useDispatch();
  let nextWorkoutId = useNextWorkoutId();

  return (workout: Workout, trainingsId?: number) => {
    dispatch({
      type: 'ADD_WORKOUT',
      workout,
      nextWorkoutId,
      trainingsId,
    } as Action);
    dispatchRecord(false, workout.sets[0], workout, dispatch, exercise, nextWorkoutId);
  };
};
