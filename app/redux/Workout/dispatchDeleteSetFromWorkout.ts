import {useDispatch} from "react-redux";
import {Action} from "redux";

export const dispatchDeleteSetFromWorkout = () => {
    const dispatch = useDispatch();

    return (set: WorkoutSet, workoutId?: number) =>
        dispatch({
            type: 'DELETE_SET_FROM_WORKOUT',
            set,
            workoutId
        } as Action);
};
