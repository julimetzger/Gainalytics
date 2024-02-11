import {View} from "react-native";
import ExercisePicker from "./ExercisePicker";
import AddWorkoutSet from "./AddWorkoutSet";
import React, {useState} from "react";
import {dispatchAddPlanedTrainigWorkout} from "../redux/Training/dispatchAddPlanedTrainigWorkout";
import {dispatchAddOrUpdateSetInWorkout} from "../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchDeleteSetFromWorkout} from "../redux/Workout/dispatchDeleteSetFromWorkout";
import {dispatchModifyExercisesInTraining} from "../redux/Training/dispatchModifyExercisesInTraining";
import {usePlannedWorkoutInTraining} from "../redux/Training/usePlannedWorkoutInTraining";
import {useExerciseByIds} from "../redux/Exercises/useExerciseByIds";


const PlanTraining = ({training, trainingsPlanId, micro, trainingInMicro}: Props) => {
    const addPlanedTraingWorkoutSet = dispatchAddPlanedTrainigWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
    let exercises = useExerciseByIds(training?.exercises ?? []);
    const [choosenExercise, setChoosenExercise] = useState<number>();
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

    function setExerciseWithSideEffects(exercsies: Exercise[]) {
        modifyExercisesInTraining(exercsies, trainingsPlanId, micro, trainingInMicro, training.id);
    }

    return (
        <View><ExercisePicker exercise={exercises} setExercise={setExerciseWithSideEffects}
                              chooseExerciseId={setChoosenExercise} choosenExerciseId={choosenExercise}/>
            {choosenExercise &&
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

            }</View>
    )
}
export default PlanTraining;

interface Props {
    training: Training,
    trainingsPlanId: number,
    micro: number,
    trainingInMicro: number
}

