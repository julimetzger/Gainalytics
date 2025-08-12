import React, {useEffect, useState, useCallback, useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/exerciseRouter';
import {Divider, Text, TextInput, useTheme, IconButton} from 'react-native-paper';
import AddExercise from '../../components/AddExercise';
import {useAlleExercises} from '../../redux/Exercises/useAllExercises';
import {Exercise} from "../../models/Exercise";
import {useSettings} from '../../redux/settings/useSettings';
import {FlashList} from '@shopify/flash-list';

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;

const ExerciseTab = ({navigation, route}: Props) => {
    const theme = useTheme();
    const [filter, setFilter] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const exercises = useAlleExercises().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));
    const settings = useSettings();

    const filteredExercises = useMemo(() => 
        exercises.filter((exercise: Exercise) => 
            exercise.name.toLowerCase().includes(filter.toLowerCase())
        ), [exercises, filter]
    );

    const handleFilterChange = useCallback((text: string) => {
        setFilter(text);
    }, []);

    const handleToggleFilter = useCallback(() => {
        setShowFilter(!showFilter);
    }, [showFilter]);

    const handleExercisePress = useCallback((exercise: Exercise) => {
        navigation.navigate({
            name: 'AddWorkoutTab',
            params: {exercise},
        });
    }, [navigation]);

    useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <IconButton icon="magnify" onPress={handleToggleFilter}>
                </IconButton>
            ),
        });
    }, [navigation, handleToggleFilter]);

    const renderExerciseItem = useCallback(({item: exercise}: {item: Exercise}) => (
        <Pressable
            key={exercise.id}
            onPress={() => handleExercisePress(exercise)}>
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
    ), [handleExercisePress]);

    const keyExtractor = useCallback((item: Exercise) => item.id?.toString() || '', []);

    return (
        <View style={{backgroundColor: theme.colors.background, flex: 1}}>
            {showFilter && (
                <TextInput label={'Filter'} value={filter} onChangeText={handleFilterChange}/>
            )}
            <FlashList
                data={filteredExercises}
                renderItem={renderExerciseItem}
                estimatedItemSize={60}
                keyExtractor={keyExtractor}
                keyboardShouldPersistTaps="handled"
            />
            <AddExercise
                style={{
                    position: 'absolute',
                    bottom: 5,
                    [settings.toggles?.showPlusButtonLeft ? 'left' : 'right']: 5
                }}
            />
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

export default ExerciseTab;
