import {useMemo} from 'react';
import {useSelector} from 'react-redux';
import {createSelector} from '@reduxjs/toolkit';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/entities/Workout';

const selectUnfinishedWorkoutByExercise = (state: GlobalState, exerciseId: number) =>
  state.workouts.notFinishedWorkouts !== undefined && state.workouts.notFinishedWorkouts[exerciseId] !== undefined ? state.workouts.byId[state.workouts.notFinishedWorkouts[exerciseId]] : undefined;

const selectSuggestedWorkoutByExercise = (state: GlobalState, exerciseId: number) =>
  state.workouts.suggestedWorkouts !== undefined && state.workouts.suggestedWorkouts[exerciseId] !== undefined ? state.workouts.suggestedWorkouts[exerciseId] : undefined;

export const makeSelectUnfinishedWorkout = () =>
  createSelector(selectUnfinishedWorkoutByExercise, selectSuggestedWorkoutByExercise, (unfinishedWorkout, suggestedWorkout): Workout | undefined => {
    if (unfinishedWorkout !== undefined && suggestedWorkout !== undefined) {
      const joinedSets = [...unfinishedWorkout.sets, ...suggestedWorkout.sets];
      joinedSets.sort((a, b) => a.index!! - b.index!!);
      const workout = {
        ...unfinishedWorkout,
        sets: joinedSets,
      };
      return workout;
    }
    if (unfinishedWorkout !== undefined) return unfinishedWorkout;
    if (suggestedWorkout !== undefined) return suggestedWorkout;
  });

export const useUnfinishedWorkout = (exerciseId: number) => {
  const selectUnfinishedWorkout = useMemo(makeSelectUnfinishedWorkout, []);
  return useSelector((state: GlobalState) => selectUnfinishedWorkout(state, exerciseId));
};
