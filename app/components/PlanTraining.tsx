import {View} from "react-native";
import AddWorkoutSet from "./AddWorkoutSet";
import React from "react";
import {dispatchAddPlanedTrainigWorkout} from "../redux/Training/dispatchAddPlanedTrainigWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {usePlannedWorkoutInTraining} from "../redux/Training/usePlannedWorkoutInTraining";
import {useAllLastWorkouts} from "../redux/Workout/useAllLastWorkouts";
import {oneRepMaxForWorkouts} from "../utils/RepetitionMaxHelper";


const PlanTraining = ({training, trainingsPlanId, micro, trainingInMicro, choosenExercise}: Props) => {
    const addPlanedTraingWorkoutSet = dispatchAddPlanedTrainigWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    const plannedWorkout = usePlannedWorkoutInTraining(training?.id, choosenExercise.id);
    let workouts = useAllLastWorkouts(choosenExercise, 1);
    let oneRepMax = oneRepMaxForWorkouts(...workouts);

    function submitPlannedWorkoutSet(workoutSet: WorkoutSet) {
        if (plannedWorkout === undefined || plannedWorkout.id === undefined) {
            addPlanedTraingWorkoutSet(trainingsPlanId, micro, trainingInMicro, choosenExercise.id!!, {
                sets: [{...workoutSet, index: workoutSet.index ?? 1}],
                notes: '',
                exerciseId: choosenExercise.id!!,
                start: new Date(Date.now())
            }, training?.id);
            return;
        }
        addOrUpdateSetInWorkout(workoutSet, plannedWorkout.id!!);
    }


    return (
        <View>
            <AddWorkoutSet
                onSubmit={(workoutSet) => submitPlannedWorkoutSet(workoutSet)} oneRepMax={oneRepMax}/>
            {plannedWorkout?.sets.map((workoutSet) => {
                return <AddWorkoutSet workoutSet={workoutSet}
                                      onSubmit={(workoutSet) => submitPlannedWorkoutSet(workoutSet)}
                                      onDelete={() => deleteSetFromWorkout(workoutSet, plannedWorkout?.id, choosenExercise.id)}/>
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
    choosenExercise: Exercise
}

