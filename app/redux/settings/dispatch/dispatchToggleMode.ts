import {useDispatch} from "react-redux";
import {Action} from "redux";

export const dispatchToggleMode = () => {
    const dispatch = useDispatch();

    return () =>
        dispatch({
            type: 'TOGGLE_MODE',
        } as Action);
};
