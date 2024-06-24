import {useDispatch} from "react-redux";
import {Action} from "redux";

import {Exercise, Record} from "../../models/Exercise";
import {calculateMetricValue} from "../../utils/RepetitionMaxHelper";
import {Metric} from "../../components/Picker";
import {WorkoutSet} from "../../models/WorkoutSet";
import {Workout} from "../../models/Workout";
import {Dispatch} from "react";

export function dispatchRecord(planningMode: boolean, set: WorkoutSet, workout: Workout, dispatch: Dispatch<any>, exercise: Exercise, workoutId: number) {
    if (!planningMode) {
        let oneRm = parseFloat(calculateMetricValue([set], Metric.ONE_RM).toFixed(2));

        //Handle Record update
        if (workout?.records?.[Record.ONE_RM] !== undefined) {
            // increase record
            if (oneRm > (workout?.records?.[Record.ONE_RM] ?? Infinity)) {
                dispatch({
                    type: 'UPDATE_RECORD',
                    record: Record.ONE_RM,
                    value: oneRm,
                    workoutId: workoutId,
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
                    workoutId: workoutId,
                    exerciseId: exercise.id
                } as Action)
                return;
            }
            // lower Record but still a record in comparison with the previeous record
            if (newOneRm < (workout?.records?.[Record.ONE_RM] ?? Infinity)) {
                dispatch({
                    type: 'UPDATE_RECORD',
                    record: Record.ONE_RM,
                    value: newOneRm,
                    workoutId: workoutId,
                    exerciseId: exercise.id
                } as Action);
                return;
            }
        } else {
            //new Record check
            if ((Math.max(...exercise.records?.[Record.ONE_RM]?.map(record => record.value ?? 0) ?? [0]) - oneRm) < -0.01) {
                dispatch({
                    type: 'ADD_RECORD',
                    record: Record.ONE_RM,
                    value: oneRm,
                    workoutId: workoutId,
                    exerciseId: exercise.id
                } as Action)
                return;
            }
        }
    }
}

export const dispatchAddOrUpdateSetInWorkout = (exercise: Exercise, planningMode: boolean = false) => {
    const dispatch = useDispatch();

    return (set: WorkoutSet, workout: Workout) => {
        dispatch({
            type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
            set,
            workoutId: workout.id
        } as Action)
        dispatchRecord(planningMode, set, workout, dispatch, exercise, workout.id!!);
    }
}
