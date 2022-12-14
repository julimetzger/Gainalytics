import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/exerciseRouter';
import {Divider, useTheme, Text, TextInput} from 'react-native-paper';
import AddExercise from '../components/AddExercise';
import {useAlleExercises} from '../redux/Exercises/useAllExercises';

const ExerciseTab = ({navigation}: Props) => {
    const theme = useTheme();
    const [filter, setFilter] = useState('');
    const exercises = useAlleExercises();

    return (
        <View style={{backgroundColor: theme.colors.background, flex: 1}}>
                <TextInput label={'Filter'} onChangeText={(text) => setFilter(text)}/>
                <ScrollView contentInsetAdjustmentBehavior="automatic">
                    {exercises
                        .filter((exercise: Exercise) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
                        .map((exercise: Exercise) => (
                            <Pressable
                                key={exercise.name}
                                onPress={() =>
                                    navigation.navigate({
                                        name: 'AddWorkoutTab',
                                        params: {exercise},
                                    })
                                }>
                                <Text style={styles.exerciseText}> {exercise.name}</Text>
                                <Divider/>
                            </Pressable>
                        ))}
                </ScrollView>
            <AddExercise/>
        </View>
    );
};

const styles = StyleSheet.create({
    exerciseText: {
        fontSize: 20,
        textAlign: 'left',
        textAlignVertical: 'center',
    },
});

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;

export default ExerciseTab;
