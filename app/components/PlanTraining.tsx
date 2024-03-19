import {View} from "react-native";
import AddWorkoutSet from "./AddWorkoutSet";
import React from "react";
import {dispatchAddPlanedTrainingWorkout} from "../redux/Training/dispatchAddPlanedTrainingWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {usePlannedWorkoutInTraining} from "../redux/Training/usePlannedWorkoutInTraining";
import {useAllLastWorkouts} from "../redux/Workout/useAllLastWorkouts";
import {oneRepMaxForWorkouts} from "../utils/RepetitionMaxHelper";
import {useNextTrainingsId} from "../redux/Training/useNextTrainingsId";
import {Training} from "../models/Training";
import {Exercise} from "../models/Exercise";


const PlanTraining = ({training, trainingsPlanId, micro, trainingInMicro, chosenExercise}: Props) => {
    const addPlanedTrainingWorkoutSet = dispatchAddPlanedTrainingWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    const plannedWorkout = usePlannedWorkoutInTraining(training?.id, chosenExercise.id);
    let workouts = useAllLastWorkouts(chosenExercise, 1);
    let oneRepMax = oneRepMaxForWorkouts(...workouts);
    let number = useNextTrainingsId();

    function submitPlannedWorkoutSet(workoutSet: WorkoutSet) {
        if (plannedWorkout === undefined || plannedWorkout.id === undefined) {
            addPlanedTrainingWorkoutSet(trainingsPlanId, micro, trainingInMicro, chosenExercise.id!!, {
                sets: [{...workoutSet, index: workoutSet.index ?? 1}],
                notes: '',
                exerciseId: chosenExercise.id!!,
                start: new Date(Date.now()),
                trainingsId: training?.id ?? number,
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
                                      key={workoutSet.index ?? "" + workoutSet.reps + workoutSet.weight + workoutSet.date?.getTime()}
                                      onSubmit={(workoutSet) => submitPlannedWorkoutSet(workoutSet)}
                                      onDelete={() => deleteSetFromWorkout(workoutSet, plannedWorkout)}/>
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
    chosenExercise: Exercise
}

