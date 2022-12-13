import {useDispatch} from "react-redux";
import {Action} from "redux";

const useDispatchUpdateWorkoutSet = () => {
    const dispatch = useDispatch();

    return (workout: Workout) =>
        dispatch({
            type: 'UPDATE_WORKOUT',
            workout,
        } as Action);
};
export default useDispatchUpdateWorkoutSet;
