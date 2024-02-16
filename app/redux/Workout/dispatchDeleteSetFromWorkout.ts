import {useDispatch} from "react-redux";
import {Action} from "redux";

export const dispatchDeleteSetFromWorkout = () => {
    const dispatch = useDispatch();

    return (set: WorkoutSet, workout?: Workout) => {
        if (workout !== undefined && workout.sets.length === 1 && workout.sets[0].index === set.index) {
            dispatch({
                type: 'DELETE_WORKOUT',
                workout
            } as Action);
            return;

        }
        dispatch({
            type: 'DELETE_SET_FROM_WORKOUT',
            set,
            workoutId: workout?.id,
            exerciseId: workout?.exerciseId,
            trainingsId: workout?.trainingsId
        } as Action);
    }
};
