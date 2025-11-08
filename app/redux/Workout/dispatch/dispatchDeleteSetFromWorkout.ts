import {useDispatch} from "react-redux";
import {Action} from "redux";
import {WorkoutSet} from "../../../models/WorkoutSet";
import {Workout} from "../../../models/Workout";
import {Record} from "../../../models/Exercise";
import {calculateMetricValue} from "../../../utils/AnalyseUtils";
import {Metric} from "../../../components/picker/elements/TrainingElementPicker";

export const dispatchDeleteSetFromWorkout = () => {
    const dispatch = useDispatch();

    return (set: WorkoutSet, workout: Workout) => {
        if (workout.sets?.length === 1 && workout.sets[0]?.index === set.index) {
            dispatch({
                type: 'DELETE_WORKOUT',
                workout
            } as Action);
            return;

        }
        dispatch({
            type: 'DELETE_SET_FROM_WORKOUT',
            set,
            exerciseId: workout.exerciseId,
            workoutId: workout.id,
            trainingsId: workout.trainingsId
        } as Action);
        if (workout?.records?.[Record.ONE_RM] === calculateMetricValue([set], Metric.ONE_RM)) {
            let workoutSets = workout.sets.filter(s => s.index !== set.index);
            let oneRm = calculateMetricValue(workoutSets, Metric.ONE_RM);
            //TODO handle record updates if there is still a record in the remaining sets
            if (workout.records[Record.ONE_RM] !== oneRm)
                dispatch({
                        type: 'DELETE_RECORD',
                        record: Record.ONE_RM,
                        workoutId: workout.id,
                        exerciseId: workout.exerciseId
                    } as Action
                )
        }
    }
};
