import {useSelector} from 'react-redux';
import {GlobalState} from '../rootReducer';

export const useWorkoutsIn = (from: Date, to: Date) =>
    useSelector((state: GlobalState) => {
            let allWorkouts = state.workouts.allIds.map((value: number) => state.workouts.byId[value]);
            return allWorkouts.filter((workout: Workout) =>
                (workout.start !== undefined && workout.end !== undefined && workout.start > from && workout.end < to)
            )
        }
    );
