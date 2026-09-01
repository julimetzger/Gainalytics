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

/**
 * The persisted in-progress workout only — never merged with the suggested one.
 *
 * `useUnfinishedWorkout` deliberately joins the suggested workout (on
 * START_TRAINING the planned workout is copied into `suggestedWorkouts`) so the
 * plan shows up as pending rows. Anything that has to know what the user has
 * ACTUALLY logged must not see those pending rows — GH-63's target banner and
 * "Set N" counter both did, which made them count planned-but-unlogged sets as
 * done.
 */
export const usePersistedUnfinishedWorkout = (exerciseId: number) =>
  useSelector((state: GlobalState) => selectUnfinishedWorkoutByExercise(state, exerciseId));
