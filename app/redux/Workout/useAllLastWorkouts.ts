import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';
import {Exercise} from "../../models/Exercise";

export const useAllLastWorkouts = (exercise: Exercise, numberOfWorkouts: number) => {
    return useSelector((state: GlobalState) => {
        if (state.workouts.byExerciseId !== undefined && state.workouts.byExerciseId[exercise.id!!] !== undefined && state.workouts.byExerciseId[exercise.id!!].length >= numberOfWorkouts) {
            let lastWorkoutIds: number[] = state.workouts.byExerciseId[exercise.id!!].slice(-numberOfWorkouts);
            return lastWorkoutIds.map(
                workoutId => state.workouts.byId[workoutId]
            ) as Workout[]
        } else
            return [] as Workout[];
    });
};
