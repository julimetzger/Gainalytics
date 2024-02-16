import {Action} from 'redux';
import {useDispatch} from "react-redux";
import {useTraining} from "./useTraining";

export const dispatchStartTraining = (trainingsId?: number) => {
    const dispatch = useDispatch();
    let training = useTraining(trainingsId);


    return () => {
        let plannedWorkouts: number[] = [];
        if (training) {
            let finishedExercises = Object.keys(training.doneWorkoutIds).map((exerciseId: string) => parseInt(exerciseId));
            plannedWorkouts = Object.keys(training.plannedWorkouts).map((exerciseId: string) => parseInt(exerciseId)).filter((exerciseId: number) => !finishedExercises.includes(exerciseId)).map((
                    exerciseId: number
                ) => {
                    return training!!.plannedWorkouts[exerciseId]
                }
            )
        }
        dispatch({
            type: 'START_TRAINING',
            trainingsId,
            workoutIds: plannedWorkouts,
            date: new Date().getTime(),
        } as Action);
    };
}
