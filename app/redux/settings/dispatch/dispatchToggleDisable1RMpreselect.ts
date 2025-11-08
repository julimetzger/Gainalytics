import {useDispatch} from "react-redux";
import {Action} from "redux";

export const dispatchToggleDisable1RMpreselect = () => {
    const dispatch = useDispatch();

    return () =>
        dispatch({
            type: 'TOGGLE_ENABLE_1RM_BUTTON',
        } as Action);
};
