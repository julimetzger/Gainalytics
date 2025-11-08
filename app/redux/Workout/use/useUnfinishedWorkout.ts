import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Workout} from '../../../models/Workout';

export const useUnfinishedWorkout = (exerciseId: number) =>
  useSelector((state: GlobalState) => {
    if (
      state.workouts.notFinishedWorkouts !== undefined &&
      state.workouts.notFinishedWorkouts[exerciseId] !== undefined &&
      state.workouts.suggestedWorkouts !== undefined &&
      state.workouts.suggestedWorkouts[exerciseId] !== undefined
    ) {
      let unfinishedWorkoutSets = state.workouts.byId[state.workouts.notFinishedWorkouts[exerciseId]].sets;
      let suggestedWorkoutSets = state.workouts.suggestedWorkouts[exerciseId].sets;
      const joinedSets = [...unfinishedWorkoutSets, ...suggestedWorkoutSets];
      joinedSets.sort((a, b) => a.index!! - b.index!!);
      return {
        ...state.workouts.byId[state.workouts.notFinishedWorkouts[exerciseId]],
        sets: joinedSets,
      } as Workout;
    }
    if (state.workouts.notFinishedWorkouts !== undefined && state.workouts.notFinishedWorkouts[exerciseId] !== undefined) return state.workouts.byId[state.workouts.notFinishedWorkouts[exerciseId]];
    if (state.workouts.suggestedWorkouts !== undefined && state.workouts.suggestedWorkouts[exerciseId] !== undefined) return state.workouts.suggestedWorkouts[exerciseId];
  });
