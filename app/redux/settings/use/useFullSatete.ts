import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';

export const useFullSatete = () => useSelector((state: GlobalState) => state);
