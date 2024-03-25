import {useDispatch} from "react-redux";
import {Action} from "redux";
import {WorkoutSet} from "../../models/WorkoutSet";
import {Workout} from "../../models/Workout";

export const dispatchDeleteSetFromWorkout = () => {
    const dispatch = useDispatch();

    return (set: WorkoutSet, workout: Workout) => {
        if (workout.sets?.length === 1 && workout.sets[0]?.index === set.index) {
            dispatch({
                type: 'DELETE_WORKOUT',
                workout
            } as Action);
            return;

        }
        dispatch({
            type: 'DELETE_SET_FROM_WORKOUT',
            set,
            exerciseId: workout.exerciseId,
            workoutId: workout.id,
            trainingsId: workout.trainingsId
        } as Action);
    }
};
