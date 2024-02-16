import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";

export const usePlannedWorkoutInTraining = (trainingId?: number, exerciseId?: number) => useSelector((state: GlobalState) => {
    if (trainingId && exerciseId) {
            let plannedWorkout = state.trainings.byId[trainingId].plannedWorkouts[exerciseId];
            if (plannedWorkout === undefined) {
                return undefined
            }
            return state.workouts.byId[plannedWorkout]
        } else {
            return undefined
        }
    }
)
