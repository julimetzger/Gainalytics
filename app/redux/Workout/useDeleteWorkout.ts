import {useDispatch} from "react-redux";
import {Action} from "redux";
import {Workout} from "../../models/Workout";

const useDeleteWorkout = () => {
    const dispatch = useDispatch();

    return (workout: Workout) =>
        dispatch({
            type: 'DELETE_WORKOUT',
            workout
        } as Action);
};
export default useDeleteWorkout;
