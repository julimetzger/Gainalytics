import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useAllLastWorkouts = () =>
    useSelector((state: GlobalState) => {
        if (state.workouts.allIds.length > 0)
            return [state.workouts.byId[Math.max(...state.workouts.allIds)]] as Workout[];
        else
            return [] as Workout[];
    });
