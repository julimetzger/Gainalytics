import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";

export const useUnfinishedWorkout = (exerciseId: number) => useSelector((state: GlobalState) => {
    if (state.workouts.notFinishedWorkouts !== undefined && state.workouts.notFinishedWorkouts[exerciseId] !== undefined)
        return state.workouts.byId[state.workouts.notFinishedWorkouts[exerciseId]];
    else
        return undefined;
});
