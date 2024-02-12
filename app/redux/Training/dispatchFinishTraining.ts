import {Action} from 'redux';
import {useDispatch} from "react-redux";

export const dispatchFinishTraining = () => {
    const dispatch = useDispatch();

    return (trainingsId: number) =>
        dispatch({
            type: 'FINISH_TRAINING',
            trainingsId,
            date: new Date().getTime(),
        } as Action);
};
