import {Pressable, ScrollView, StyleSheet, View} from "react-native"
import React, {useState} from "react";
import {Card, ProgressBar, Text, TextInput} from "react-native-paper";
import {useAllTrainingsPlans} from "../../redux/Training/useAllTrainingsPlans";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import AddTrainingsPlan from "./AddTrainingsPlan";

const TrainingHome = ({navigation}: Props) => {
    const [filter, setFilter] = useState('');
    const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));

    return (
        <View style={{ flex: 1}}>
            <TextInput label={'Filter'} onChangeText={(text) => setFilter(text)}/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                {trainingsPlans
                    .filter((exercise: TrainingsPlan) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
                    .map((trainingsPlan: TrainingsPlan) => (
                        <Card style={{margin: 5}}>
                            <ProgressBar style={{margin: 5}} visible={true} progress = {0.5}></ProgressBar>
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
