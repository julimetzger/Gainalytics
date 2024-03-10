import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import {Divider, Text, TextInput, useTheme} from 'react-native-paper';
import AddExercise from '../../components/AddExercise';
import {useAlleExercises} from '../../redux/Exercises/useAllExercises';

const ExerciseTab = ({navigation}: Props) => {
    const theme = useTheme();
    const [filter, setFilter] = useState('');
    const exercises = useAlleExercises().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));

    return (
        <View style={{backgroundColor: theme.colors.background, flex: 1}}>
            <TextInput label={'Filter'} onChangeText={(text) => setFilter(text)}/>
            <ScrollView contentInsetAdjustmentBehavior="automatic">
                {exercises
                    .filter((exercise: Exercise) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
                    .map((exercise: Exercise) => (
                        <Pressable
                            key={exercise.id}
                            onPress={() =>
                                navigation.navigate({
                                    name: 'AddWorkoutTab',
                                    params: {exercise},
                                })
                            }>
                            <View style={{
                                flexDirection: 'row',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <Text style={styles.exerciseText}> {exercise.name}</Text>
                                <AddExercise exerciseId={exercise.id}/>
                            </View>
                            <Divider/>
                        </Pressable>
                    ))}
            </ScrollView>
            <AddExercise style={styles.addExercise}/>
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

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;

export default ExerciseTab;
