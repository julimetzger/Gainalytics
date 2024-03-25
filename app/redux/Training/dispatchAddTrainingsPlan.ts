import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {TrainingsPlan} from "../../models/TrainingsPlan";

export const dispatchAddTrainingsPlan = () => {
    const dispatch = useDispatch();

    return (trainingsPlan: TrainingsPlan) =>
        dispatch({
            type: 'ADD_TRAININGS_PLAN',
            trainingsPlan,
        } as Action);
};
