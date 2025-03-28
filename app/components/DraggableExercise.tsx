import React, {useRef, useState} from 'react';
import {Dimensions, LayoutRectangle, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import DraggableFlatList, {RenderItemParams, ScaleDecorator} from 'react-native-draggable-flatlist';
import {IconButton, useTheme} from 'react-native-paper';
import {Exercise} from '../models/Exercise';
import SwipeView from 'react-native-vertical-swipe-view';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Item = {
    key: number;
    label: string;
};

interface Props {
    exercises: Exercise[];
    chosenExercise?: Exercise;
    chooseExercise: (exercise: Exercise) => void;
    setExercises: (exercises: Exercise[]) => void;
    doneExerciseIds: number[];
    setAbsolutePosition: (layout: LayoutRectangle) => void;
}

const DraggableExercise = ({
                               exercises,
                               setExercises,
                               chosenExercise,
                               chooseExercise,
                               doneExerciseIds,
                               setAbsolutePosition
                           }: Props) => {
        let theme = useTheme();
        let exerciseData = exercises.map((exercise) => {
            return {
                key: exercise.id,
                label: exercise.name,
            } as Item;
        });
        let edgeInsets = useSafeAreaInsets();
        const textRef = useRef<View>(null);
        const [positionInternal, setPositionInternal] = useState<LayoutRectangle>()

        const screenWidth = Dimensions.get('window').width;

        const spreadEvenly = (percentage: number) => {
            return percentage / 100 > 0.125 ? percentage / 100 : 0.125 * screenWidth;
        };

        const spreadMax = (numberOfExercises: number) => {
            return numberOfExercises <= 4 ? RPW((1 / numberOfExercises) * 100) : RPW(25);
        };

        const RPW = (percentage: number) => {
            return (percentage / 100) * screenWidth;
        };
        const styles = StyleSheet.create({
            rowItem: {
                height: 60,
                alignItems: 'center',
                justifyContent: 'center',
            },
            text: {
                margin: 4,
                minWidth: spreadEvenly(exercises.length),
                maxWidth: spreadMax(exercises.length),
                color: theme.colors.onSecondaryContainer,
                fontSize: theme.fonts.bodyMedium.fontSize,
                marginTop: -4,
                fontWeight: 'bold',
                textAlign: 'center',
            },
        });

        const onPress = (item: Item) => {
            chooseExercise(exercises.find((exercise) => exercise.id === item.key)!!);
        };

        const renderItem = ({item, drag, isActive}: RenderItemParams<Item>) => {
            const [interactive, setInteractive] = useState(false);
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
                                    ? theme.colors.tertiaryContainer
                                        : doneExerciseIds.includes(item.key)
                                            ? theme.colors.primaryContainer
                                            : theme.colors.secondaryContainer,
                                borderColor: item.key === chosenExercise?.id ? theme.colors.onPrimaryContainer : 'transparent',
                                borderWidth: item.key === chosenExercise?.id ? 2 : 0,
                            },
                        ]}>
                        <SwipeView
                            position="top"
                            style={{marginTop: -20}}
                            maxHeight={30}
                            headerStyle={{
                                backgroundColor: 'transparent',
                                height: 25,
                                minWidth: spreadEvenly(exercises.length),
                                maxWidth: spreadMax(exercises.length),
                            }}
                            renderHeader={() => <View style={{flex: 1}}/>}
                            onRequestShow={() => setInteractive(true)}
                            onRequestClose={() => setInteractive(false)}>
                            {interactive && (
                                <IconButton
                                    style={{marginTop: 10}}
                                    icon={'close-circle'}
                                    iconColor={theme.colors.tertiaryContainer}
                                    onPress={() => {
                                        setExercises(exercises.filter((exercise) => exercise.id !== item.key));
                                    }}
                                />
                            )}
                        </SwipeView>
                        <Text
                            numberOfLines={3}
                            style={[
                                styles.text,
                                {
                                    color: isActive
                                        ? theme.colors.onPrimaryContainer
                                        : item.key === chosenExercise?.id
                                            ? theme.colors.onPrimaryContainer
                                            : doneExerciseIds.includes(item.key)
                                                ? theme.colors.onPrimaryContainer
                                                : theme.colors.onSecondaryContainer,
                                },
                            ]}>
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                </ScaleDecorator>
            );
        };

        function setPosition() {
            textRef.current?.measureInWindow((x, y, width, height) => {
                let layout = {x, y: y - edgeInsets.top, width, height};
                layout.height = 60;
                if (positionInternal === undefined || positionInternal.y !== layout.y) {
                    setPositionInternal(layout);
                    setAbsolutePosition(layout);
                }
            })
        }

        return (
            <View
                ref={textRef}
                collapsable={false}
                onLayout={() => setPosition()}
            >
                {exerciseData.length > 0 && (
                    <DraggableFlatList
                        keyboardShouldPersistTaps={'always'}
                        horizontal
                        data={exerciseData}
                        onDragEnd={(items) => setExercises(items.data.map((item) => exercises.find((exercise) => exercise.id === item.key)).filter((exercise) => exercise !== undefined) as Exercise[])}
                        keyExtractor={(item) => item.key.toString()}
                        renderItem={renderItem}
                    />
                )}
            </View>
        );
    }
;

export default DraggableExercise;
