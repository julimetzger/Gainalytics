import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';
import {determineNewId} from "../normalizedState";
import {determineNewWorkoutId} from "../normalizedWorkoutState";

export const useNextWorkoutId = () => useSelector((state: GlobalState) => determineNewWorkoutId(state.workouts));
