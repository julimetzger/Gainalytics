import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";
import {Range} from "../../components/DateRangePicker";
import {dateComparator, HOURS_IN_MILLIS} from "../../utils/DateHelper";
import {compareArrays} from "../../utils/ArrayUtils";

export const useDateWorkoutMapByIds = (ids: number[]) => useSelector((state: GlobalState) => {
    let workouts = ids.map(id => state.workouts.byId[id]);
    let dateWorkoutMap = new Map<Date, number[]>();
    workouts.forEach(
        (workout) => {
            let sameWorkoutDate: Date = Array.from(dateWorkoutMap.keys()).find((date) =>
                    new Range(new Date(new Date(date).getTime() - HOURS_IN_MILLIS * 5), new Date(new Date(date).getTime() + HOURS_IN_MILLIS * 5)).dateIsInRange(workout.start!!))
                ?? workout.start!!;
            dateWorkoutMap.set(sameWorkoutDate, [...dateWorkoutMap.get(sameWorkoutDate) ?? [], workout.id!!]);
        }
    )
    return new Map([...dateWorkoutMap.entries()].sort((a, b) => -dateComparator(a[0], b[0])));
}, (a, b) => {
    let aKeys = Array.from(a.keys());
    let bkeys = Array.from(b.keys());
    let aInB = aKeys.every((key) => b.has(key) && compareArrays(a.get(key)!!, b.get(key)!!));
    let bInA = bkeys.every((key) => a.has(key) && compareArrays(a.get(key)!!, b.get(key)!!));
    return aInB && bInA;
});
