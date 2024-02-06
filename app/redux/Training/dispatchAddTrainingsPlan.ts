import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchAddTrainingsPlan = () => {
    const dispatch = useDispatch();

    return (trainingsPlan: TrainingsPlan) =>
        dispatch({
            type: 'ADD_TRAININGS_PLAN',
            trainingsPlan,
        } as Action);
};
