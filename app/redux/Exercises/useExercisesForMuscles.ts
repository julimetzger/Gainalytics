import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';
import {Muscles} from "../../models/Muscles";

export const useExercisesForMuscles = (muscles: Muscles[]) => useSelector((state: GlobalState) =>
    state.exercises.allIds.map((value: number) => state.exercises.byId[value])
        .filter((value) => value.muscles?.some(s => muscles.includes(s.muscle))));
