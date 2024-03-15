import React, {useEffect, useState} from "react";
import {ScrollView, View} from "react-native";
import {Button, IconButton, Text} from "react-native-paper";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {useTrainingsPlan} from "../../redux/Training/useTrainingsPlan";
import {useTrainingInTrainingsPlan} from "../../redux/Training/useTrainingInTrainingsPlan";
import PlanWorkoutInTraining from "../../components/PlanTraining";
import ExecuteWorkoutInTraining from "../../components/ExecuteTraining";
import {dispatchStartTraining} from "../../redux/Training/dispatchStartTraining";
import {useExerciseByIds} from "../../redux/Exercises/useExerciseByIds";
import {dispatchModifyExercisesInTraining} from "../../redux/Training/dispatchModifyExercisesInTraining";
import {dispatchFinishTraining} from "../../redux/Training/dispatchFinishTraining";
import TrainingHistory from "../../components/TrainingHistory";
import {TrainingsState} from "../../models/TrainingsState";
import DraggableExercise from "../../components/DraggableExercise";
import Picker from "../../components/Picker";
import Timer from "../../components/Timer";
import TrainingsOverview from "../../components/TrainingsOverview";
import TrainingsBase from "../../components/TrainingsBase";

const TrainingsPlanTab = ({route}: Props) => {
    const trainingsPlan = useTrainingsPlan(route.params.trainingsPlan.id!!);
    const [micro, setMicro] = useState(1);
    const [trainingInMicro, setTrainingInMicro] = useState(1);
    const [timeInWorkout, setTimeInWorkout] = useState(new Date(Date.now()));
    const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
    const lastTraining = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro - 1, trainingInMicro);
    const startTraining = dispatchStartTraining(training?.id);
    const [overview, setOverview] = useState(true)
    let exercises = useExerciseByIds(training?.exercises ?? []);
    const [chosenExercise, setchosenExercise] = useState(exercises?.length > 1 ? exercises[0] : undefined)
    let modifyExercisesInTraining = dispatchModifyExercisesInTraining();
    let finishTraining = dispatchFinishTraining();


    useEffect(() => {
        if (training?.state === TrainingsState.STARTED) {
            startTraining();
        }
    }, [micro, trainingInMicro]);

    function setExerciseWithSideEffects(exercises: Exercise[]) {
        modifyExercisesInTraining(exercises, trainingsPlan.id!!, micro, trainingInMicro, training?.id);
    }

    function changePlanningmode() {
        if (training?.state === TrainingsState.PLANNED) {
            startTraining();
        }
        if (training?.state === TrainingsState.STARTED) {
            finishTraining(training.id!!);
        }
        if (training?.state === TrainingsState.FINISHED) {
            if (chosenExercise === undefined)
                setchosenExercise(exercises[0])
            setOverview(!overview);
        }
        setTimeInWorkout(new Date(Date.now()));
    }

    function goToNextExercise() {
        const number = exercises.indexOf(chosenExercise!!) + 1;
        if (number >= exercises.length) {
            return;
        }
        setTimeInWorkout(new Date(Date.now()));
        setchosenExercise(exercises[number])
    }

    return (
        <View style={{flexDirection: 'column', justifyContent: 'space-between', flex: 1}}>
            <ScrollView keyboardShouldPersistTaps={"always"}>
                <View>
                    <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-evenly'}}>
                        {training?.state === TrainingsState.STARTED &&
                            <Timer start={training.start!!} label={'Start Training'}/>}
                        <Button mode='outlined' onPress={changePlanningmode}>
                            {training?.state === undefined && "Plan Training"}
                            {training?.state === TrainingsState.PLANNED && "Start Training"}
                            {training?.state === TrainingsState.STARTED && "Finish Training"}
                            {training?.state === TrainingsState.FINISHED && overview && "Show Sets"}
                            {training?.state === TrainingsState.FINISHED && !overview && "Show Overview"}
                        </Button>
                        {training?.state === TrainingsState.STARTED &&
                            <Timer start={timeInWorkout} reset={true} label={"Last Set"}/>}
                    </View>

                    {(training?.state === TrainingsState.STARTED || training?.state === TrainingsState.PLANNED || training === undefined) &&
                        <View>
                            <Picker exercise={exercises} setExercise={setExerciseWithSideEffects}/>
                            <DraggableExercise exercises={exercises}
                                               setExercises={setExerciseWithSideEffects}
                                               chosenExercise={chosenExercise}
                                               chooseExercise={setchosenExercise}/>
                        </View>}
                    {training === undefined &&
                        <TrainingsBase trainingsPlan={trainingsPlan} micro={micro} trainingInMicro={trainingInMicro}/>}

                    {chosenExercise && training?.state === TrainingsState.PLANNED &&
                        <PlanWorkoutInTraining training={training}
                                               trainingsPlanId={trainingsPlan.id!!}
                                               trainingInMicro={trainingInMicro}
                                               micro={micro}
                                               chosenExercise={chosenExercise!!}
                        />
                    }
                    {training?.state === TrainingsState.STARTED && chosenExercise &&
                        <ExecuteWorkoutInTraining
                            training={training}
                            chosenExercise={chosenExercise!!}
                            onSubmit={() => goToNextExercise()}
                            onSubmitSet={() => setTimeInWorkout(new Date(Date.now()))}
                        />}

                    {training?.state === TrainingsState.FINISHED && overview &&
                        <TrainingsOverview training={training} previousTraining={lastTraining}/>}

                    {training?.state === TrainingsState.FINISHED && !overview &&
                        <TrainingHistory training={training}/>}
                </View>
            </ScrollView>
            <View style={{display: 'flex', justifyContent: 'center'}}>
                <Text>{"Micro " + micro + " " + "Training " + trainingInMicro} </Text>
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
