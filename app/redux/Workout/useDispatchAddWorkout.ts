import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {useNextWorkoutId} from "./useNextWorkoutId";
import {Workout} from "../../models/Workout";


/**
 * add fully build workout to redux store
 */
export const useDispatchAddWorkout = () => {
    const dispatch = useDispatch();
    let nextWorkoutId = useNextWorkoutId();

    return (workout: Workout, trainingsId?: number) =>
        dispatch({
            type: 'ADD_WORKOUT',
            workout,
            nextWorkoutId,
            trainingsId
        } as Action);
};
