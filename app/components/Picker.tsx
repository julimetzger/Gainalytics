import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React, {useState} from 'react';
import {MultiselectDropdown} from "sharingan-rn-modal-dropdown";
import {IconButton, useTheme} from "react-native-paper";
import {StyleProp, View, ViewStyle} from "react-native";

const Picker = ({
                    exercise,
                    setExercise,
                    style,
                    metric,
                    setMetric,
                    setAccumaltionMode,
                    accumaltionMode,
                    disabled = true
                }: ExercisePickerProps) => {
    const [show, setShow] = useState(disabled)
    let allExercises = useAlleExercises()
    let theme = useTheme();
    let selectedExercises = exercise.map((exercise: Exercise) => exercise.id ? exercise.id : 0).map((value: number) => value.toString());
    let dropdownExerciseStructure = allExercises.map((exercise: Exercise) => {
        return {
            label: exercise.name,
            value: exercise.id!!.toString(),
        }
    });
    metric ? selectedExercises.push(metric) : 0;
    accumaltionMode ? selectedExercises.push(accumaltionMode) : 0;
    Object.values(Metric).map((value: string) => {
        dropdownExerciseStructure.push({label: value, value: value})
    })
    Object.values(AccumaulationMode).map((value: string) => {
        dropdownExerciseStructure.push({label: value, value: value})
    })

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
                        style={show ? {position: 'absolute', top: 0, right: 0} : {
                            position: 'absolute',
                            bottom: 0,
                            right: 0
                        }}
                        icon={!show ? 'chevron-down' : 'chevron-up'}
                        onPress={() => setShow(!show)}></IconButton>
        </View>);

    function setExerciseDumb(value: string[]) {
        let newMetric = value.filter((value: string) => Object.values(Metric).includes(value as Metric));
        if (newMetric.length > 1) {
            newMetric = newMetric.filter((value: string) => value !== metric)
        }
        let newAccumalationMode = value.filter((value: string) => Object.values(AccumaulationMode).includes(value as AccumaulationMode));
        if (newAccumalationMode.length > 1) {
            newAccumalationMode = newAccumalationMode.filter((value: string) => value !== accumaltionMode)
        }
        let allIds = allExercises.map((value: Exercise) => value.id?.toString());
        let exercises = value.filter((value: string) => allIds.includes(value));
        let find = exercises.map((value: string) => allExercises.find((exercise: Exercise) => exercise.id === parseInt(value)))
            .filter((value: Exercise | undefined) => value !== undefined) as Exercise[]
        setExercise(find);
        setMetric ? setMetric(newMetric[0] as Metric) : 0;
        setAccumaltionMode ? setAccumaltionMode(newAccumalationMode[0] as AccumaulationMode) : 0;
    }
}

export enum Metric {
    VOLUME = 'Volume',
    ONE_RM = '1RM',
    MAX_INTENSITY = 'Max Intensity',
    AVERAGE_INTENSITY = 'Average Intensity',
    SETS = 'Sets',
    REPS = 'Reps',
}

export enum AccumaulationMode {
    SINGLE_DAY = 'Day',
    //WEEK = 'Week',
    // MONTH = 'Month',
    //TRAINING_MICROCYCLE = 'Training Microcycle',
}

interface ExercisePickerProps {
    exercise: Exercise[],
    setExercise: (arg: Exercise[]) => void,
    style?: StyleProp<ViewStyle>
    disabled?: boolean
    metric?: Metric,
    setMetric?: (arg: Metric) => void,
    accumaltionMode?: AccumaulationMode,
    setAccumaltionMode?: (arg: AccumaulationMode) => void
}

export default Picker;
