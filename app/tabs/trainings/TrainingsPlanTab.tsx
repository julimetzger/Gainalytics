import React, {useEffect, useState} from "react";
import {ScrollView, View} from "react-native";
import {Button, Text} from "react-native-paper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {useAllTrainingsPlans} from "../../redux/Training/useTrainingsPlan";
import ExercisePicker from "../../components/ExercisePicker";
import AddWorkoutSet from "../../components/AddWorkoutSet";
import {dispatchAddPlanedTrainigWorkout} from "../../redux/Training/dispatchAddPlanedTrainigWorkout";
import {useTrainingInTrainingsPlan} from "../../redux/Training/useTrainingInTrainingsPlan";
import {usePlannedWorkoutInTraining} from "../../redux/Training/usePlannedWorkoutInTraining";
import {dispatchAddOrUpdateSetInWorkout} from "../../redux/Workout/dispatchAddOrUpdateSetInWorkout";
import {dispatchDeleteSetFromWorkout} from "../../redux/Workout/dispatchDeleteSetFromWorkout";

const TrainingsPlanTab = ({navigation, route}: Props) => {
    const trainingsPlan = useAllTrainingsPlans(route.params.trainingsPlan.id!!);
    const [exercise, setExercise] = useState<Exercise[]>([]);
    const [micro, setMicro] = useState(1);
    const [trainingInMicro, setTrainingInMicro] = useState(1);
    const [planingMode, setPlaningMode] = useState(true);
    const [choosenExercise, setChoosenExercise] = useState<number>();
    const trainingInTrainingsPlan = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
    const addPlanedTraingWorkoutSet = dispatchAddPlanedTrainigWorkout();
    let addOrUpdateSetInWorkout = dispatchAddOrUpdateSetInWorkout();
    let deleteSetFromWorkout = dispatchDeleteSetFromWorkout();
    const plannedWorkout = usePlannedWorkoutInTraining(trainingInTrainingsPlan?.id, choosenExercise);
    console.log(plannedWorkout);
    function submitPlannedWorkoutSet(workoutSet: WorkoutSet) {
        if (plannedWorkout === undefined || plannedWorkout.id === undefined) {
            addPlanedTraingWorkoutSet(trainingsPlan.id!!, micro, trainingInMicro, choosenExercise!!, {
                sets: [{...workoutSet, index: workoutSet.index ?? 1}],
                notes: '',
                exerciseId: choosenExercise!!,
                start: new Date(Date.now())
            }, trainingInTrainingsPlan?.id);
            return;
        }
        addOrUpdateSetInWorkout(workoutSet, plannedWorkout.id!!);
    }


    return (
        <ScrollView>
            <Button onPress={() => setPlaningMode(!planingMode)}>
                Start Training
            </Button>
            <ExercisePicker exercise={exercise} setExercise={setExercise}
                            chooseExerciseId={setChoosenExercise} choosenExerciseId={choosenExercise}/>
            <Text>{choosenExercise}</Text>
            {planingMode && choosenExercise ?
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
                :
                <View/>
            }
        </ScrollView>
    )
        ;
}
export type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default TrainingsPlanTab;
