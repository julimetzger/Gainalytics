import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React, {useState} from 'react';
import {MultiselectDropdown} from "sharingan-rn-modal-dropdown";
import {Button, IconButton, useTheme} from "react-native-paper";
import {StyleProp, View, ViewStyle} from "react-native";

const ExercisePicker = ({
                            exercise,
                            setExercise,
                            style,
                            disabled = true
                        }: ExercisePickerProps) => {
    const [show, setShow] = useState(disabled)
    let exercises = useAlleExercises()
    let theme = useTheme();
    let selectedExercises = exercise.map((exercise: Exercise) => exercise.id ? exercise.id : 0);
    let dropdownExerciseStructure = exercises.map((exercise: Exercise) => {
        return {
            label: exercise.name,
            value: exercise.id,
        }
    });

    return (<View style={style}>
        {show && <MultiselectDropdown label="Choose Exercises"
                                      enableSearch value={selectedExercises}
                                      searchInputTheme={theme}
                                      onChange={setExerciseDumb}
                                      data={dropdownExerciseStructure} paperTheme={theme} disableSort={false}
                                      selectedItemViewStyle={{display: 'none'}}
                                      primaryColor={theme.colors.primaryContainer}
                                      textInputPlaceholderColor={theme.colors.onPrimaryContainer}
                                      multiline={true}/>}
        <IconButton style={{position: 'absolute', top: 0, right: 0}} icon={!show ? 'chevron-up' : 'chevron-down'}
                    onPress={() => setShow(!show)}></IconButton>
    </View>);

    function setExerciseDumb(value: number[]) {
        console.log("beforeSet", value);
        let find = value.map((value: number) => exercises.find((exercise: Exercise) => exercise.id === value))
            .filter((value: Exercise | undefined) => value !== undefined) as Exercise[]
        console.log("set", find);
        setExercise(find);
    }
}

interface ExercisePickerProps {
    exercise: Exercise[],
    setExercise: (arg: Exercise[]) => void,
    style?: StyleProp<ViewStyle>
    disabled?: boolean
}

export default ExercisePicker;
