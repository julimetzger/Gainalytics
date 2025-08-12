import {calculateMetricValue} from "../../utils/RepetitionMaxHelper";
import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";
import {Metric} from "../../components/Picker";
import {compareArrays} from "../../utils/ArrayUtils";
import {Workout} from "../../models/Workout";
import {createSelector} from 'reselect';

// Memoized selector für bessere Performance
const selectWorkoutsByIds = createSelector(
    [(state: GlobalState) => state.workouts.byId, (state: GlobalState, workoutIds: number[]) => workoutIds],
    (workoutsById, workoutIds) => workoutIds.map(id => workoutsById[id]).filter(Boolean)
);

const selectHighlightWorkoutIds = createSelector(
    [selectWorkoutsByIds, (state: GlobalState, workoutIds: number[], highlightMode?: Metric) => highlightMode],
    (workouts, highlightMode) => {
        if (highlightMode === undefined) return [];
        
        const highlightValue = calculateMetricValue(workouts.flatMap((workout: Workout) => workout.sets), highlightMode);
        return workouts
            .filter(workout => calculateMetricValue(workout.sets, highlightMode) === highlightValue)
            .map(workout => workout.id!!);
    }
);

export const useHighlightWorkout = (workoutIds: number[], highlightMode?: Metric) => 
    useSelector((state: GlobalState) => selectHighlightWorkoutIds(state, workoutIds, highlightMode), 
        (a, b) => compareArrays(a, b) ?? true
    );

