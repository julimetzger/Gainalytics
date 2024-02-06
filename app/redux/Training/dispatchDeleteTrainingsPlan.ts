import {useDispatch} from 'react-redux';
import {Action} from 'redux';

export const dispatchDeleteTrainingsPlan = () => {
    const dispatch = useDispatch();

    return (trainingsPlanId: number) =>
        dispatch({
            type: 'DELETE_TRAININGS_PLAN',
            trainingsPlanId,
        } as Action);
};
