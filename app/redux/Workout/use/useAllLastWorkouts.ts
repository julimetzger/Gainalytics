import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {createSelector} from '@reduxjs/toolkit';
import {GlobalState} from '../../rootReducer';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';

const selectWorkoutIdsByExercise = (state: GlobalState, exerciseId: number | undefined) => {
  if (exerciseId === undefined || state.workouts.byExerciseId === undefined) {
    return undefined;
  }
  return state.workouts.byExerciseId[exerciseId];
};

const selectWorkoutsById = (state: GlobalState) => state.workouts.byId;

const passNumberOfWorkouts = (_state: GlobalState, _exerciseId: number | undefined, numberOfWorkouts: number) => numberOfWorkouts;

export const makeSelectAllLastWorkouts = () =>
  createSelector(selectWorkoutIdsByExercise, selectWorkoutsById, passNumberOfWorkouts, (workoutIds, byId, numberOfWorkouts): Workout[] => {
    if (workoutIds !== undefined) {
      const lastWorkoutIds = workoutIds.slice(-numberOfWorkouts);
      return lastWorkoutIds.map((workoutId) => byId[workoutId]);
    }
    return [];
  });

export const useAllLastWorkouts = (exercise: Exercise, numberOfWorkouts: number) => {
  const selectAllLastWorkouts = useMemo(makeSelectAllLastWorkouts, []);
  return useSelector((state: GlobalState) => selectAllLastWorkouts(state, exercise.id!!, numberOfWorkouts));
};
