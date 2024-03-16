import React, {useEffect, useState} from "react";
import {Text, View, StyleSheet, TouchableOpacity} from "react-native";
import DraggableFlatList, {
    RenderItemParams,
    ScaleDecorator,
} from "react-native-draggable-flatlist";
import {Dimensions} from 'react-native';
import {useTheme} from "react-native-paper";

type Item = {
    key: number;
    label: string;
};

interface Props {
    exercises: Exercise[];
    chosenExercise?: Exercise;
    chooseExercise: (exercise: Exercise) => void;
    setExercises: (exercises: Exercise[]) => void;
}

const DraggableExercise = ({exercises, setExercises, chosenExercise, chooseExercise}: Props) => {
    let theme = useTheme();
    let exerciseData = exercises.map(
        (exercise) => {
            return {
                key: exercise.id,
                label: exercise.name,
            } as Item
        }
    );


    const screenWidth = Dimensions.get('window').width;

    const spreedEvenly = (percentage: number) => {
        return (percentage / 100) > 0.125 ? (percentage / 100) : 0.125 * screenWidth;
    }

    const spreedMax = (numberOfExercises: number) => {
        return numberOfExercises <= 4 ? RPW(1 / numberOfExercises * 100) : RPW(25);
    }

    const RPW = (percentage: number) => {
        return (percentage / 100) * screenWidth;
    }
    const styles = StyleSheet.create({
        rowItem: {
            height: 60,
            alignItems: "center",
            justifyContent: "center",
        },
        text: {
            margin: 3,
            minWidth: spreedEvenly(exercises.length),
            maxWidth: spreedMax(exercises.length),
            color: theme.colors.onSecondaryContainer,
            fontSize: theme.fonts.bodyMedium.fontSize,
            fontWeight: "bold",
            textAlign: "center",
        },
    });

    const onPress = (item: Item) => {
        chooseExercise(exercises.find((exercise) => exercise.id === item.key)!!);
    }

    const renderItem = ({item, drag, isActive}: RenderItemParams<Item>) => {
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    onPress={() => onPress(item)}
                    style={[
                        styles.rowItem,
                        {
                            backgroundColor: isActive
                                ? theme.colors.primaryContainer
                                : item.key === chosenExercise?.id
                                    ? theme.colors.tertiaryContainer
                                    : theme.colors.secondaryContainer
                        }
                    ]}
                >
                    <Text
                        style={[
                            styles.text,
                            {
                                color: isActive
                                    ? theme.colors.onPrimaryContainer
                                    : item.key === chosenExercise?.id
                                        ? theme.colors.onPrimaryContainer
                                        : theme.colors.onSecondaryContainer
                            }
                        ]}
                    >
                        {item.label}
                    </Text>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <View>
            {exerciseData.length > 0 &&
                <DraggableFlatList keyboardShouldPersistTaps={'always'}
                                   horizontal
                                   data={exerciseData}
                                   onDragEnd={(items) => setExercises(items.data.map((item) => exercises.find((exercise) => exercise.id === item.key)).filter(exercise => exercise !== undefined) as Exercise[])}
                                   keyExtractor={(item) => item.key.toString()}
                                   renderItem={renderItem}
                />
            }
        </View>
    )
        ;
}

export default DraggableExercise;


