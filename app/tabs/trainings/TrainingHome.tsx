import {Pressable, ScrollView, StyleSheet, View} from "react-native"
import React, {useState} from "react";
import {Divider, Text, TextInput, useTheme} from "react-native-paper";
import {useAllTrainingsPlans} from "../../redux/Training/useAllTrainingsPlans";
import {RootStackParamList} from "../../routing/TrainingRouter";
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import AddTrainingsPlan from "./AddTrainingsPlan";

const TrainingHome = ({navigation}: Props) => {
    const theme = useTheme();
    const [filter, setFilter] = useState('');
    const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));

    return (
        <View style={{backgroundColor: theme.colors.background, flex: 1}}>
            <TextInput label={'Filter'} onChangeText={(text) => setFilter(text)}/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                {trainingsPlans
                    .filter((exercise: TrainingsPlan) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
                    .map((trainingsPlan: TrainingsPlan) => (
                        <Pressable
                            key={trainingsPlan.name}
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
                            <Divider/>
                        </Pressable>
                    ))}
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
