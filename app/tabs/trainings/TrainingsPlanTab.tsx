import React, {useEffect, useState} from "react";
import {ScrollView, View} from "react-native";
import {Button, IconButton, Text} from "react-native-paper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {useAllTrainingsPlans} from "../../redux/Training/useTrainingsPlan";
import {useTrainingInTrainingsPlan} from "../../redux/Training/useTrainingInTrainingsPlan";
import PlanWorkoutInTraining from "../../components/PlanTraining";
import ExecuteWorkoutInTraining from "../../components/ExecuteTraining";
import {dispatchStartTraining} from "../../redux/Training/dispatchStartTraining";
import ExercisePicker from "../../components/ExercisePicker";
import {useExerciseByIds} from "../../redux/Exercises/useExerciseByIds";
import {dispatchModifyExercisesInTraining} from "../../redux/Training/dispatchModifyExercisesInTraining";
import {dispatchFinishTraining} from "../../redux/Training/dispatchFinishTraining";
import TrainingHistory from "../../components/TrainingHistory";
import {TrainingsState} from "../../models/TrainingsState";
import DraggableList from "../../components/DraggableList";

const TrainingsPlanTab = ({route}: Props) => {
    const trainingsPlan = useAllTrainingsPlans(route.params.trainingsPlan.id!!);
    const [micro, setMicro] = useState(1);
    const [trainingInMicro, setTrainingInMicro] = useState(1);
    const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
    const startTraining = dispatchStartTraining(training?.id);
    const [overview, setOverview] = useState(true)
    let exercises = useExerciseByIds(training?.exercises ?? []);
    const [choosenExercise, setChoosenExercise] = useState(exercises?.length > 1 ? exercises[0] : undefined)
    let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
    let finishTraining = dispatchFinishTraining();

    useEffect(() => {
        if (training?.state === TrainingsState.STARTED) {
            startTraining();
        }
    }, [micro, trainingInMicro]);

    function setExerciseWithSideEffects(exercsies: Exercise[]) {
        modifyExercisesInTraining(exercsies, trainingsPlan.id!!, micro, trainingInMicro, training?.id);
    }

    function changePlanningmode() {
        if (training?.state === TrainingsState.PLANNED) {
            startTraining();
        }
        if (training?.state === TrainingsState.FINISHED) {
            if (choosenExercise === undefined)
                setChoosenExercise(exercises[0])
            setOverview(!overview);
        }
    }

    function goToNextExercise() {
        const number = exercises.indexOf(choosenExercise!!) + 1;
        if (number >= exercises.length) {
            finishTraining(training.id!!);
            return;
        }

        setChoosenExercise(exercises[number])
    }

    return (
        <View style={{flexDirection: 'column', justifyContent: 'space-between', flex: 1}}>
            <ScrollView>
                <View>
                    <Button onPress={changePlanningmode}>
                        {training?.state === TrainingsState.PLANNED && "Start Training"}
                        {training?.state === TrainingsState.STARTED && "Finish Training"}
                        {training?.state === TrainingsState.FINISHED && overview && "Show Sets"}
                        {training?.state === TrainingsState.FINISHED && !overview && "Show Overview"}
                    </Button>
                    <ExercisePicker exercise={exercises} setExercise={setExerciseWithSideEffects}/>
                    {exercises.length > 0 && <DraggableList exercises={exercises} choosenExercise={choosenExercise}
                                                            chooseExercise={setChoosenExercise}/>}
                    {choosenExercise && training?.state === TrainingsState.PLANNED &&
                        <PlanWorkoutInTraining training={training}
                                               trainingsPlanId={trainingsPlan.id!!}
                                               trainingInMicro={trainingInMicro}
                                               micro={micro}
                                               choosenExercise={choosenExercise!!}
                        />
                    }
                    {training?.state === TrainingsState.STARTED && choosenExercise &&
                        <ExecuteWorkoutInTraining
                            training={training}
                            choosenExercise={choosenExercise!!}
                            onSubmit={() => goToNextExercise()}
                        />}
                    {training?.state === TrainingsState.FINISHED && overview &&
                        <View><Text>Training completed, Markus approves. Heim gehen und gains abholen. Der
                            Thunfischshake
                            wartet
                            auf dich! </Text>
                        </View>}
                    {training?.state === TrainingsState.FINISHED && !overview &&
                        <TrainingHistory training={training} choosenExercise={choosenExercise!!}/>}
                </View>
            </ScrollView>
            <View style={{display: 'flex', justifyContent: 'center'}}>
                <Text>{"Micro " + micro + "training " + trainingInMicro} </Text>
                <View style={{flexDirection: 'row'}}>
                    <IconButton icon={"chevron-left"} onPress={() => setMicro(micro - 1)}/>
                    <IconButton icon={"chevron-right"} onPress={() => setMicro(micro + 1)}/>
                    <IconButton icon={"chevron-down"} onPress={() => setTrainingInMicro(trainingInMicro + 1)}/>
                    <IconButton icon={"chevron-up"} onPress={() => setTrainingInMicro(trainingInMicro - 1)}/>
                </View>
            </View>
        </View>
    )
        ;
}

export type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default TrainingsPlanTab;
