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
    choosenExercise?: Exercise;
    chooseExercise: (exercise: Exercise) => void;
}

const DraggableList = ({exercises, choosenExercise, chooseExercise}: Props) => {
    let theme = useTheme();
    let exerciseData = exercises.map(
        (exercise) => {
            return {
                key: exercise.id,
                label: exercise.name,
            } as Item
        }
    );
    const [data, setData] = useState(exerciseData);

    useEffect(() => {
        setData(exerciseData);
    }, [exercises]);


    const screenWidth = Dimensions.get('window').width;

    const spreedEvenly = (percentage: number) => {
        return (percentage / 100) > 0.125 ? (percentage / 100) : 0.125 * screenWidth;
    }

    const RPW = (percentage: number) => {
        return (percentage / 100) * screenWidth;
    }
    const styles = StyleSheet.create({
        rowItem: {
            height: 50,
            alignItems: "center",
            justifyContent: "center",
        },
        text: {
            margin:3,
            minWidth: spreedEvenly(exercises.length),
            maxWidth: RPW(25),
            color: theme.colors.onSecondaryContainer,
            fontSize: theme.fonts.bodyLarge.fontSize,
            fontWeight: "bold",
            textAlign: "center",
        },
    });

    const onPresss = (item: Item) => {
        chooseExercise(exercises.find((exercise) => exercise.id === item.key)!!);
    }

    const renderItem = ({item, drag, isActive}: RenderItemParams<Item>) => {
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    onPress={() => onPresss(item)}
                    style={[
                        styles.rowItem,
                        {
                            backgroundColor: isActive ? theme.colors.tertiaryContainer : item.key === choosenExercise?.id ? theme.colors.primaryContainer : theme.colors.secondaryContainer,
                        },
                    ]}
                >
                    <Text
                        style={[styles.text, {color: isActive ? theme.colors.onTertiaryContainer : item.key === choosenExercise?.id ? theme.colors.onPrimaryContainer : theme.colors.onSecondaryContainer}]}>{item.label}</Text>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <View>
            {data.length > 1 &&
                <DraggableFlatList
                    horizontal
                    data={data}
                    onDragEnd={({data}) => setData(data)}
                    keyExtractor={(item) => item.key.toString()}
                    renderItem={renderItem}
                />
            }
        </View>
    )
        ;
}

export default DraggableList;


