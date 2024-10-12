import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";

export const useWorkoutsByIds = (ids: number[]) => useSelector((state: GlobalState) => ids.map(id => state.workouts.byId[id]).filter(workout => workout !== undefined));
