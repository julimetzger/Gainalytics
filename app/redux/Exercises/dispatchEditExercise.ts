import {Action} from 'redux';
import {useDispatch} from "react-redux";
import {MusclePercentPair} from "../../components/MusclePicker";

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
