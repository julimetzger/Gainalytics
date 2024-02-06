import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchEditTrainingsPlan = () => {
    const dispatch = useDispatch();

    return (trainingsPlanId: number, name: String) =>
        dispatch({
            type: 'EDIT_TRAININGS_PLAN',
            trainingsPlanId,
            name
        } as Action);
};
