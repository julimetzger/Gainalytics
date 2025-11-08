import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export const useSettings = () => useSelector((state: GlobalState) => state.settings);
