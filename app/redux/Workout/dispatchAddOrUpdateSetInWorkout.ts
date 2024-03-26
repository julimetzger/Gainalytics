import {useDispatch} from "react-redux";
import {Action} from "redux";

import {Exercise, Record} from "../../models/Exercise";
import {calculateMetricValue} from "../../utils/RepetitionMaxHelper";
import {Metric} from "../../components/Picker";
import {WorkoutSet} from "../../models/WorkoutSet";
import {Workout} from "../../models/Workout";

export const dispatchAddOrUpdateSetInWorkout = (exercise: Exercise, planningMode: boolean = false) => {
    const dispatch = useDispatch();

    return (set: WorkoutSet, workout: Workout) => {
        dispatch({
            type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
            set,
            workoutId: workout.id
        } as Action)
        if (!planningMode) {
            let oneRm = calculateMetricValue([set], Metric.ONE_RM);

            //Handle Record update
            if (workout?.records?.[Record.ONE_RM] !== undefined) {
                // increase record
                if (oneRm > (workout?.records?.[Record.ONE_RM] ?? Infinity)) {
                    dispatch({
                        type: 'UPDATE_RECORD',
                        record: Record.ONE_RM,
                        value: oneRm,
                        workoutId: workout.id,
                        exerciseId: exercise.id
                    } as Action)
                    return;
                }
                let previousRecordIndex = (exercise?.records?.[Record.ONE_RM]?.findIndex(record => record.workoutId === workout.id) ?? 0) - 1;
                let previousRecord = previousRecordIndex >= 0 ? exercise?.records?.[Record.ONE_RM]?.[previousRecordIndex]?.value ?? 0 : 0;
                let newWorkoutSets = [set, ...workout.sets.filter(s => s.index !== set.index)];

                let newOneRm = calculateMetricValue(newWorkoutSets, Metric.ONE_RM);
                // lower Record below previeous record -> delete record
                if (newOneRm < previousRecord) {
                    dispatch({
                        type: 'DELETE_RECORD',
                        record: Record.ONE_RM,
                        workoutId: workout.id,
                        exerciseId: exercise.id
                    } as Action)
                    return;
                }
                // lower Record but still a record in comparison with the previeous record
                dispatch({
                    type: 'UPDATE_RECORD',
                    record: Record.ONE_RM,
                    value: newOneRm,
                    workoutId: workout.id,
                    exerciseId: exercise.id
                } as Action);
                return;
            }
            console.log(oneRm, workout?.records?.[Record.ONE_RM] ?? Infinity)
            console.log("records", exercise?.records?.[Record.ONE_RM]);
            console.log("old record", Math.max(...exercise.records?.[Record.ONE_RM]?.map(record => record.value ?? 0) ?? [0]));
            //new Record check
            if (oneRm > Math.max(...exercise.records?.[Record.ONE_RM]?.map(record => record.value ?? 0) ?? [0])) {
                dispatch({
                    type: 'ADD_RECORD',
                    record: Record.ONE_RM,
                    value: oneRm,
                    workoutId: workout.id,
                    exerciseId: exercise.id
                } as Action)
                return;
            }
        }
    }
}
