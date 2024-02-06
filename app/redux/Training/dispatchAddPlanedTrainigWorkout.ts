import {useDispatch, useSelector} from 'react-redux';
import {Action} from 'redux';
import {useNextTrainingsId} from "./useNextTrainingsId";
import {useNextWorkoutId} from "../Workout/useNextWorkoutId";

export const dispatchAddPlanedTrainigWorkout = () => {
    const dispatch = useDispatch();
    let nextTrainingsId = useNextTrainingsId();
    let nextWorkoutId = useNextWorkoutId();

    return (trainingsPlanId: number, microNumber: number, trainingInMicroNumber: number, exerciseId: number, workout: Workout, trainingsId?: number) =>
        dispatch({
            type: 'ADD_PLANED_TRAINING_WORKOUT',
            trainingsPlanId,
            microNumber,
            trainingInMicroNumber,
            exerciseId,
            workout,
            trainingsId,
            nextTrainingsId,
            nextWorkoutId

        } as Action);
};
