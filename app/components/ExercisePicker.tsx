import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React from 'react';
import {MultiselectDropdown} from "sharingan-rn-modal-dropdown";
import {IconButton, useTheme} from "react-native-paper";
import {StyleProp, View, ViewStyle} from "react-native";

const ExercisePicker = ({exercise, setExercise, style, chooseExercise, choosenExercise}: ExercisePickerProps) => {
    let exercises = useAlleExercises()
    let theme = useTheme();
    let selectedExercises = exercise.map((exercise: Exercise) => exercise.id ? exercise.id : 0);
    let dropdownExerciseStructure = exercises.map((exercise: Exercise) => {
        return {
            label: exercise.name,
            value: exercise.id,
            avatarComponent: chooseExercise && selectedExercises.includes(exercise.id!!) ?
                <IconButton iconColor={theme.colors.onPrimaryContainer}
                            icon={choosenExercise?.id === exercise.id ? 'circle' : 'circle-outline'}
                            onPress={() => {
                                chooseExercise(exercise)
                            }}/> : <View></View>
        }
    });

    return (<View style={style}>
        <MultiselectDropdown label="Choose Exercises" enableSearch value={selectedExercises} onChange={setExerciseDumb}
                             data={dropdownExerciseStructure} paperTheme={theme}
                             primaryColor={theme.colors.primaryContainer} enableAvatar={chooseExercise ? true : false}
                             multiline={true}/>
    </View>);

    function setExerciseDumb(value: number[]) {
        let find = exercises.filter((exerciseFilter: Exercise) => value.includes(exerciseFilter.id ? exerciseFilter.id : 0));
        if (find !== undefined) {
            setExercise(find);
        }
    }
}

interface ExercisePickerProps {
    exercise: Exercise[],
    setExercise: (arg: Exercise[]) => void,
    style?: StyleProp<ViewStyle>
    chooseExercise?: (exercise: Exercise) => void
    choosenExercise?: Exercise
}

export default ExercisePicker;
