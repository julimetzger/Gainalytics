import {Action} from 'redux';
import {useDispatch} from "react-redux";

import {MusclePercentPair} from "../../../models/Exercise";

export const dispatchEditExercise = () => {
    const dispatch = useDispatch();

    return (exerciseId: number, nameOfExercise: String, muscles: MusclePercentPair[]) =>
        dispatch({
            type: 'EDIT_EXERCISE',
            exerciseId,
            nameOfExercise,
            muscles
        } as Action);
};
