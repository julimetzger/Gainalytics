import {useDispatch} from "react-redux";
import {Action} from "redux";

export const dispatchAddOrUpdateSetInWorkout = () => {
    const dispatch = useDispatch();

    return (set: WorkoutSet, workoutId?: number) =>
        dispatch({
            type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
            set,
            workoutId
        } as Action);
};
