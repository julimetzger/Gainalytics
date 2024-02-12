import {Action} from 'redux';
import {useDispatch} from "react-redux";
import {useTraining} from "./useTraining";

export const dispatchStartTraining = (trainingsId?: number) => {
    const dispatch = useDispatch();
    let training = useTraining(trainingsId);

    return () =>
        dispatch({
            type: 'START_TRAINING',
            trainingsId,
            workoutIds: training ? Object.values(training.plannedWorkouts) : [],
            date: new Date().getTime(),
        } as Action);
};
