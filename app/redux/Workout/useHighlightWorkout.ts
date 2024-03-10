import {calculateMetricValue} from "../../utils/RepetitionMaxHelper";
import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";
import {Metric} from "../../components/Picker";
import {compareArrays} from "../../utils/ArrayUtils";


export const useHighlightWorkout = (workoutIds: number[], highlightMode?: Metric) => useSelector((state: GlobalState) => {
    let workouts = workoutIds.map(id => state.workouts.byId[id]);
    let highlighWorkoutIds: number[] = [];
    if (highlightMode !== undefined) {
        let highlightValue = highlightMode ? calculateMetricValue(workouts.flatMap((workout: Workout) => workout.sets), highlightMode) : undefined;
        highlighWorkoutIds = workouts.filter(workout => calculateMetricValue(workout.sets, highlightMode) === highlightValue).map(workout => workout.id!!);
    }
    return highlighWorkoutIds;
}, (a, b) => {
    return compareArrays(a, b) ?? true;
});

