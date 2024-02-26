import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React, {useState} from 'react';
import {MultiselectDropdown} from "sharingan-rn-modal-dropdown";
import {IconButton, useTheme} from "react-native-paper";
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

    return (
        <View style={style}>
            {show && <MultiselectDropdown label="Choose Exercises"
                                          enableSearch value={selectedExercises}
                                          onChange={setExerciseDumb}
                                          searchInputTheme={{colors: {primary: theme.colors.primaryContainer}}}
                                          data={dropdownExerciseStructure} paperTheme={theme} disableSort={false}
                                          selectedItemViewStyle={{display: 'none'}}
                                          primaryColor={theme.colors.primaryContainer}
            />}
            <IconButton mode='outlined'
                style={show ? {position: 'absolute', right: 0} : {position: 'absolute', bottom: -5, right: 0}}
                icon={!show ? 'chevron-down' : 'chevron-up'}
                onPress={() => setShow(!show)}></IconButton>
        </View>);

    function setExerciseDumb(value: number[]) {
        let find = value.map((value: number) => exercises.find((exercise: Exercise) => exercise.id === value))
            .filter((value: Exercise | undefined) => value !== undefined) as Exercise[]
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
