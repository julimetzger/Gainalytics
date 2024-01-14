import {Action} from 'redux';
import {useDispatch} from "react-redux";

export const dispatchEditExercise = () => {
    const dispatch = useDispatch();

    return (exerciseId: number, nameOfExercise: String) =>
        dispatch({
            type: 'EDIT_EXERCISE',
            exerciseId,
            nameOfExercise,
        } as Action);
};
