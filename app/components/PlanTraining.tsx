import {View} from "react-native";
import AddWorkoutSet from "./AddWorkoutSet";
import React from "react";
import {dispatchAddPlanedTrainigWorkout} from "../redux/Training/dispatchAddPlanedTrainigWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {usePlannedWorkoutInTraining} from "../redux/Training/usePlannedWorkoutInTraining";


const PlanTraining = ({training, trainingsPlanId, micro, trainingInMicro, choosenExercise}: Props) => {
    const addPlanedTraingWorkoutSet = dispatchAddPlanedTrainigWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    const plannedWorkout = usePlannedWorkoutInTraining(training?.id, choosenExercise);

    function submitPlannedWorkoutSet(workoutSet: WorkoutSet) {
        if (plannedWorkout === undefined || plannedWorkout.id === undefined) {
            addPlanedTraingWorkoutSet(trainingsPlanId, micro, trainingInMicro, choosenExercise!!, {
                sets: [{...workoutSet, index: workoutSet.index ?? 1}],
                notes: '',
                exerciseId: choosenExercise!!,
                start: new Date(Date.now())
            }, training?.id);
            return;
        }
        addOrUpdateSetInWorkout(workoutSet, plannedWorkout.id!!);
    }


    return (
        <View>
            <AddWorkoutSet
                onSubmit={(workoutSet) => submitPlannedWorkoutSet(workoutSet)}/>
            {plannedWorkout?.sets.map((workoutSet) => {
                return <AddWorkoutSet workoutSet={workoutSet}
                                      onSubmit={(workoutSet) => submitPlannedWorkoutSet(workoutSet)}
                                      onDelete={() => deleteSetFromWorkout(workoutSet, plannedWorkout?.id, choosenExercise)}/>
            })
            }
        </View>
    )
}
export default PlanTraining;

interface Props {
    training: Training,
    trainingsPlanId: number,
    micro: number,
    trainingInMicro: number,
    choosenExercise: number
}

