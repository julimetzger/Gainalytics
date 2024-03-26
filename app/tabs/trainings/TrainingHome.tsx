import {Pressable, ScrollView, StyleSheet, View} from "react-native"
import React, {useState} from "react";
import {Card, ProgressBar, Text, TextInput} from "react-native-paper";
import {useAllTrainingsPlans} from "../../redux/Training/useAllTrainingsPlans";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import AddTrainingsPlan from "./AddTrainingsPlan";
import {TrainingsState} from "../../models/TrainingsState";
import {useTrainings} from "../../redux/Training/useTrainings";
import {Exercise} from "../../models/Exercise";
import {TrainingsPlan} from "../../models/TrainingsPlan";

const TrainingHome = ({navigation}: Props) => {
    const [filter, setFilter] = useState('');
    const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));
    const allTrainings = useTrainings();
    let startedTrainings = allTrainings.filter(A => A.state === TrainingsState.STARTED)
    let planToStarteTrainin = new Map(trainingsPlans.map(train => {
        let idOfTraining = Object.values(train.trainings).find(tr => startedTrainings.map(startetd => startetd.id).includes(tr))
        let training = startedTrainings.find(A => A.id === idOfTraining);
        let number = training ? Object.values(training.doneWorkoutIds).length / Object.values(training.plannedWorkouts).length : undefined;
        return idOfTraining ? [train.id, number] : undefined
    }).filter(A => A !== undefined) as Array<[number, number]>);

    return (
        <View style={{flex: 1}}>
            <TextInput label={'Filter'} onChangeText={(text) => setFilter(text)}/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                {trainingsPlans
                    .filter((exercise: TrainingsPlan) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
                    .map((trainingsPlan: TrainingsPlan) => (
                        <Card style={{margin: 5}}>
                            <ProgressBar style={{margin: 5}}
                                         visible={planToStarteTrainin.get(trainingsPlan.id!!) !== undefined}
                                         progress={planToStarteTrainin.get(trainingsPlan.id!!)}></ProgressBar>
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
                            </Pressable>
                        </Card>
                    ))
                }
            </ScrollView>
            <AddTrainingsPlan style={styles.addExercise}/>
        </View>
    );
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
    },
    editExercise: {}
});

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingHome'>;


export default TrainingHome;
