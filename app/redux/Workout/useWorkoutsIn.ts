import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';
import {Range} from "../../tabs/DateRangePicker";

function findWorkoutsIn(state: GlobalState, range: Range) {
    let allWorkouts: Workout[] = state.workouts.allIds.map((value: number) => state.workouts.byId[value]);
    return allWorkouts.filter((workout: Workout) =>
        (workout.start !== undefined && workout.end !== undefined && new Date(workout.start).getTime() > new Date(range.startDate).getTime() && new Date(workout.end).getTime() < new Date(range.endDate).getTime())
    )
}

export const useWorkoutsIn = (range: Range) =>
    useSelector((state: GlobalState) => findWorkoutsIn(state, range),
        (left, right) => left.length === right.length);
