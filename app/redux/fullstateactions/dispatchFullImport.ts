import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {GlobalState} from "../rootReducer";

export const dispatchFullImport = () => {
    const dispatch = useDispatch();

    return (state:GlobalState) =>
        dispatch({
            type: 'FULL_IMPORT',
            state
        } as Action);
};
