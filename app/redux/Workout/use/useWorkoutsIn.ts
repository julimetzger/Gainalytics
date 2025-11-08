import {useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {Range} from "../../../components/picker/date/DateRangePicker";
import {createSelector} from "@reduxjs/toolkit";
import {NormalizedState} from "../../normalizedState";
import {Workout} from "../../../models/Workout";


const selectAllIds = ((state: GlobalState) => state.workouts)

const passRange = (state: GlobalState, range: Range) => range;

function findWorkoutsIn(allIds: NormalizedState<Workout>, range: Range) {
    let allWorkouts: Workout[] = allIds.allIds.map((value: number) => allIds.byId[value]);
    return allWorkouts.filter((workout: Workout) =>
        (workout.start !== undefined
            && new Date(workout.start).getTime() > new Date(range.startDate).getTime())
        && new Date(workout.end ?? workout.start).getTime() < new Date(range.endDate).getTime())
}

const selector =
    createSelector(selectAllIds, passRange, (allIds: NormalizedState<Workout>, range: Range) => findWorkoutsIn(allIds, range));

export const useWorkoutsIn = (range: Range) => useSelector((state: GlobalState) => selector(state, range), (left, right) => left.length === right.length)
