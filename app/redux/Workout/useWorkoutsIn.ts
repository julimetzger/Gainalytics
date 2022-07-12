import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';
import {Range} from "../../tabs/DateRangePicker";

export const useWorkoutsIn = (range: Range) =>
    useSelector((state: GlobalState) => {
            let allWorkouts = state.workouts.allIds.map((value: number) => state.workouts.byId[value]);
            return allWorkouts.filter((workout: Workout) =>
                (workout.start !== undefined && workout.end !== undefined && workout.start > range.startDate && workout.end < range.endDate)
            )
        }
    );
