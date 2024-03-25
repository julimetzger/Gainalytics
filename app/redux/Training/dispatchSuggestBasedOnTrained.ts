import {Action} from 'redux';
import {useDispatch} from "react-redux";
import {useNextTrainingsId} from "./useNextTrainingsId";
import {useLastTrainingInMicro} from "./useLastTrainingInMicro";
import {useNextWorkoutId} from "../Workout/useNextWorkoutId";
import {useWorkoutsByIds} from "../Workout/useWorkoutsByIds";
import {Workout} from "../../models/Workout";

export const dispatchSuggestBasedOnTrained = (trainingsPlanId: number, trainingsNumber: number)  => {
    const dispatch = useDispatch();
    let nextTrainingsId = useNextTrainingsId();
    let nextWorkoutId = useNextWorkoutId();
    let lastTrainingInMicro = useLastTrainingInMicro(trainingsPlanId, trainingsNumber);
    let workouts = useWorkoutsByIds(lastTrainingInMicro?.doneWorkoutIds ? Object.values(lastTrainingInMicro.doneWorkoutIds) : []);
    if (lastTrainingInMicro?.doneWorkoutIds ? Object.values(lastTrainingInMicro.doneWorkoutIds).length
        > 0 : false) {
        let map = workouts.map((workout, index) =>
            [nextWorkoutId + index, workout] as [number, Workout]
        );
        let workoutIdWorkoutMap = new Map(map);
        return (trainingsPlanId: number, microNumber: number, trainingInMicroNumber: number) =>
            dispatch({
                type: 'SUGGEST_TRAINING',
                trainingsPlanId,
                microNumber,
                trainingInMicroNumber,
                nextTrainingsId,
                lastTrainingInMicro,
                workoutIdWorkoutMap
            } as Action);
    }
};
