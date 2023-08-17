import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React from 'react';
import {MultiselectDropdown} from "sharingan-rn-modal-dropdown";
import {useTheme} from "react-native-paper";
import {StyleProp, View, ViewStyle} from "react-native";

const ExercisePicker = ({exercise, setExercise, style}: ExercisePickerProps) => {
    let exercises = useAlleExercises()
    let theme = useTheme();
    let choosenExercises = exercise.map((exercise: Exercise) => exercise.id ? exercise.id : 0);
    let dropdownExerciseStructure = exercises.map((exercise: Exercise) => {
        return {
            label: exercise.name,
            value: exercise.id
        }
    });

    return (<View style={style}>
        <MultiselectDropdown label="Choose Exercises" enableSearch value={choosenExercises} onChange={setExerciseDumb}
                             data={dropdownExerciseStructure} paperTheme={theme} primaryColor={theme.colors.primary}/>
    </View>);

    function setExerciseDumb(value: number[]) {
        let find = exercises.filter((exerciseFilter: Exercise) => value.includes(exerciseFilter.id? exerciseFilter.id : 0));
        if (find !== undefined) {
            setExercise(find);
        }
    }
}

interface ExercisePickerProps {
    exercise: Exercise[],
    setExercise: (arg: Exercise[]) => void,
    style?: StyleProp<ViewStyle>
}

export default ExercisePicker;
