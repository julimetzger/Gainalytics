import {useDispatch} from "react-redux";
import {Action} from "redux";

export const dispatchSetFinishTrainingTimer = () => {
    const dispatch = useDispatch();

    return (seconds?: number) =>
        dispatch({
            type: 'SET_FINISH_TRAINING_TIMER',
            seconds: seconds
        } as Action);
};
