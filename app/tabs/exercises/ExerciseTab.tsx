import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import {Divider, Text, TextInput, useTheme, IconButton} from 'react-native-paper';
import AddExercise from '../../components/AddExercise';
import {useAlleExercises} from '../../redux/Exercises/useAllExercises';
import {Exercise} from "../../models/Exercise";

const ExerciseTab = ({navigation, route}: Props) => {
    const theme = useTheme();
    const [filter, setFilter] = useState(route.params?.filter || '');
    const [showFilter, setShowFilter] = useState(false);
    const exercises = useAlleExercises().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <IconButton icon="magnify" onPress={() => setShowFilter(!showFilter)}>
                </IconButton>
            ),
        });
    }, [navigation, showFilter]);

    return (
        <View style={{backgroundColor: theme.colors.background, flex: 1}}>
            {showFilter && (
                <TextInput label={'Filter'} value={filter} onChangeText={(text) => setFilter(text)}/>
            )}
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
    }
});

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;

export default ExerciseTab;
