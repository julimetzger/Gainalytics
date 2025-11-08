import {useDispatch} from "react-redux";
import {Action} from "redux";

export const dispatchSetPauseTimer = () => {
    const dispatch = useDispatch();

    return (seconds?: number) =>
        dispatch({
            type: 'SET_PAUSE_TIMER',
            seconds: seconds
        } as Action);
};
