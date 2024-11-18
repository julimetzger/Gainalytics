import {Pressable, ScrollView, StyleSheet, View} from "react-native"
import React, {useState} from "react";
import {Button, Card, ProgressBar, Text, TextInput} from "react-native-paper";
import {useAllTrainingsPlans} from "../../redux/Training/useAllTrainingsPlans";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import AddTrainingsPlan from "./AddTrainingsPlan";
import {TrainingsState} from "../../models/TrainingsState";
import {useTrainings} from "../../redux/Training/useTrainings";
import {Exercise} from "../../models/Exercise";
import {TrainingsPlan} from "../../models/TrainingsPlan";
import {
    getMicroFromTrainingInMicroIndex,
    getTrainingFromTrainingInMicroIndex
} from "../../redux/Training/trainingsPlanReducer";

interface TrainingMapping {
    firstStartedTraining?: {
        micro: number;
        training: number;
        percentOfDone: number;
    }
    lastDoneTraining?: {
        micro: number;
        training: number;
    }
    nextTraining?: {
        micro: number;
        training: number;
    }
}

const TrainingHome = ({navigation}: Props) => {
    const [filter, setFilter] = useState('');
    const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));
    const allTrainings = useTrainings();
    let startedTrainings = allTrainings.filter(A => A.state === TrainingsState.STARTED)

    let planToStarteTraining = new Map(trainingsPlans.map(train => {
                    let firstStartedTraining = handleStartedTraining(train);
                    let lastDone = lastDonee(train);
                    return [train.id, {
                        firstStartedTraining: firstStartedTraining, lastDoneTraining: lastDone
                    }]
                }
            ).filter(A => A !== undefined) as Array<[number, TrainingMapping]>
        )
    ;

    return (
        <View style={{flex: 1}}>
            <TextInput label={'Filter'} onChangeText={(text) => setFilter(text)}/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                {trainingsPlans
                    .filter((exercise: TrainingsPlan) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
                    .map((trainingsPlan: TrainingsPlan) => (
                        <Card style={{margin: 5}}>
                            
                            <Pressable
                                key={trainingsPlan.id}
                                onPress={() =>
                                    navigation.navigate({
                                        name: 'Training',
                                        params: {trainingsPlan: trainingsPlan},
                                    })
                                }>
                                <View style={{
                                    flexDirection: 'row',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <Text style={styles.exerciseText}> {trainingsPlan.name}</Text>
                                    <AddTrainingsPlan trainingsId={trainingsPlan.id}/>
                                </View>
                                <ProgressBar
                                         visible={planToStarteTraining.get(trainingsPlan.id!!)?.firstStartedTraining !== undefined}
                                         progress={planToStarteTraining.get(trainingsPlan.id!!)?.firstStartedTraining?.percentOfDone}>
                                </ProgressBar>
                                {planToStarteTraining.get(trainingsPlan.id!!)?.nextTraining &&
                                    <Button onPress={() =>
                                        navigation.navigate({
                                            name: 'Training',
                                            params: {
                                                trainingsPlan: trainingsPlan,
                                                micro: planToStarteTraining.get(trainingsPlan.id!!)?.nextTraining?.micro,
                                                training: planToStarteTraining.get(trainingsPlan.id!!)?.nextTraining?.training
                                            },
                                        })
                                    }>Active Training</Button>}
                                {planToStarteTraining.get(trainingsPlan.id!!)?.firstStartedTraining &&
                                    <Button onPress={() =>
                                        navigation.navigate({
                                            name: 'Training',
                                            params: {
                                                trainingsPlan: trainingsPlan,
                                                micro: planToStarteTraining.get(trainingsPlan.id!!)?.firstStartedTraining?.micro,
                                                training: planToStarteTraining.get(trainingsPlan.id!!)?.firstStartedTraining?.training
                                            },
                                        })
                                    }>Active Training</Button>}
                                {planToStarteTraining.get(trainingsPlan.id!!)?.lastDoneTraining &&
                                    <Button onPress={() =>
                                        navigation.navigate({
                                            name: 'Training',
                                            params: {
                                                trainingsPlan: trainingsPlan,
                                                micro: planToStarteTraining.get(trainingsPlan.id!!)?.lastDoneTraining?.micro,
                                                training: planToStarteTraining.get(trainingsPlan.id!!)?.lastDoneTraining?.training
                                            },
                                        })
                                    }>Last Training</Button>}
                            </Pressable>
                        </Card>
                    ))
                }
            </ScrollView>
            <AddTrainingsPlan style={styles.addExercise}/>
        </View>
    );

    function handleStartedTraining(train: TrainingsPlan) {
        let idOfTraining = Object.values(train.trainings).find(tr => startedTrainings.map(startetd => startetd.id).includes(tr))
        let training = startedTrainings.find(A => A.id === idOfTraining);
        let numberOfExercises = training ? Object.values(training.exercises).length : 1;
        numberOfExercises = numberOfExercises === 0 ? 1 : numberOfExercises;
        let number = training ? Object.values(training.doneWorkoutIds).length / numberOfExercises : undefined;
        let microTrainingIndex = Object.entries(train.trainings).find(([key, value]) => value === idOfTraining)?.[0];
        return training ? {
            firstStatertedTrainingId: training?.id,
            micro: getMicroFromTrainingInMicroIndex(microTrainingIndex!!),
            training: getTrainingFromTrainingInMicroIndex(microTrainingIndex!!),
            percentOfDone: number
        } : undefined;
    }

    function lastDonee(train: TrainingsPlan) {
        let microTrainingIndex = train.lastTraining ? Object.entries(train.trainings).find(([key, value]) => value === train.lastTraining)?.[0] : undefined;
        let lastDone = microTrainingIndex ? {
            micro: getMicroFromTrainingInMicroIndex(microTrainingIndex!!),
            training: getTrainingFromTrainingInMicroIndex(microTrainingIndex!!),
        } : undefined;
        return lastDone;
    }
};

const styles = StyleSheet.create({
    exerciseText: {
        fontSize: 20,
        textAlign: 'left',
        textAlignVertical: 'center',
        margin: 5,
    },
    addExercise: {
        position: 'absolute',
        bottom: 5,
        right: 5
    }
});

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingHome'>;


export default TrainingHome;
