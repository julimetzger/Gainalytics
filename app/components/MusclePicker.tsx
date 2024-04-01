import {View} from "react-native";
import DropDown from "react-native-paper-dropdown";
import {IconButton, TextInput, useTheme} from "react-native-paper";
import React, {useEffect, useState} from "react";
import {Muscles} from "../models/Muscles";
import {MusclePercentPair} from "../models/Exercise";

interface MusclePickerProps {
    muscleValue: MusclePercentPair,
    setMuscles: (muscles: MusclePercentPair) => void,
    onDelete: (muscle: MusclePercentPair) => void
}

const MusclePicker = ({setMuscles, muscleValue, onDelete}: MusclePickerProps) => {
    const [dropdownVisible, setDropdownVisible] = useState(false)
    let theme = useTheme();
    useEffect(() => {

    }, [muscleValue]);

    return (
        <View style={{display: 'flex', flexDirection: 'row'}}>
            <DropDown
                label={'Muscle'}
                mode="outlined"
                visible={dropdownVisible} onDismiss={() => setDropdownVisible(false)}
                showDropDown={() => setDropdownVisible(true)} value={muscleValue?.muscle}
                setValue={(muscleUpdate) => setMuscles({muscle: muscleUpdate, percent: muscleValue?.percent ?? 100})}
                list={Object.values(Muscles).map((value: string) => {
                    return {label: value, value: value}
                })}/>
            <TextInput keyboardType="numeric" inputMode={"numeric"} label={'% Involvement'}
                       mode="outlined"
                       defaultValue={"100"}
                       selectTextOnFocus={true}
                       value={muscleValue?.percent?.toString()}
                       onChangeText={(value) => setMuscles({
                           muscle: muscleValue?.muscle,
                           percent: parseInt(value)
                       })}/>
            <IconButton icon={"close-circle"} iconColor={theme.colors.tertiaryContainer}
                                onPress={() => {
                                    onDelete(muscleValue)}}/>
        </View>
    )
}
export default MusclePicker;
