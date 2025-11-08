import {useDispatch} from 'react-redux';
import {Action} from 'redux';
import {useNextTrainingsId} from "../../use/useNextTrainingsId";
import {Exercise} from "../../../../models/Exercise";

export const dispatchModifyExercisesInTraining = () => {
    const dispatch = useDispatch();
    let nextTrainingsId = useNextTrainingsId();

    return (exercises: Exercise[], trainingsPlanId: number, microNumber: number, trainingInMicroNumber: number, trainingsId?: number) =>
        dispatch({
            type: 'MODIFY_EXERCISES_IN_TRAINING',
            exercises,
            trainingsPlanId,
            microNumber,
            trainingInMicroNumber,
            nextTrainingsId,
            trainingsId

        }) as Action;
};
