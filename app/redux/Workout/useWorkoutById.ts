import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";

export const useWorkoutById = (id?: number) => useSelector( (state: GlobalState) => state.workouts.byId[id] )
