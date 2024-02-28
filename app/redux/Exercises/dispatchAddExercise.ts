import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {MusclePercentPair} from "../../components/MusclePicker";

export const useDispatchAddExercise = () => {
    const dispatch = useDispatch();

    return (nameOfExercise: String, muscles: MusclePercentPair[]) =>
        dispatch({
            type: 'ADD_EXERCISE',
            nameOfExercise,
            muscles,
        } as Action);
};
