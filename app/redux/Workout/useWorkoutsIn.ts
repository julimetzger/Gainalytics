import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';
import {Range} from "../../tabs/DateRangePicker";

function findWorkoutsIn(state: GlobalState, range: Range) {
    let allWorkouts: Workout[] = state.workouts.allIds.map((value: number) => state.workouts.byId[value]);
    return allWorkouts.filter((workout: Workout) =>
        (workout.start !== undefined && workout.end !== undefined && workout.start > range.startDate && workout.end < range.endDate)
    )
}

export const useWorkoutsIn = (range: Range) =>
    useSelector((state: GlobalState) => findWorkoutsIn(state, range),
        (left, right) => left.length === right.length);
