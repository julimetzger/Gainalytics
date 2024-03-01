import {View} from "react-native";
import DropDown from "react-native-paper-dropdown";
import {Button, TextInput} from "react-native-paper";
import React, {useEffect, useState} from "react";
import {Muscles} from "../models/Muscles";

interface MusclePickerProps {
    muscleValue: MusclePercentPair,
    setMuscles: (muscles: MusclePercentPair) => void,
    onDelete: (muscle: MusclePercentPair) => void
}

export interface MusclePercentPair {
    muscle?: Muscles,
    percent?: number
}

const MusclePicker = ({setMuscles, muscleValue, onDelete}: MusclePickerProps) => {
    const [dropdownVisible, setDropdownVisible] = useState(false)
    useEffect(() => {

    }, [muscleValue]);

    return (
        <View style={{display: 'flex', flexDirection: 'row'}}>
            <DropDown
                label={'Muscle'}
                visible={dropdownVisible} onDismiss={() => setDropdownVisible(false)}
                showDropDown={() => setDropdownVisible(true)} value={muscleValue?.muscle}
                setValue={(muscleUpdate) => setMuscles({muscle: muscleUpdate, percent: muscleValue?.percent ?? 100})}
                list={Object.values(Muscles).map((value: string) => {
                    return {label: value, value: value}
                })}/>
            <TextInput keyboardType="numeric" inputMode={"numeric"} label={'Percentage of Involvement'}
                       defaultValue={"100"}
                       value={muscleValue?.percent?.toString()}
                       onChangeText={(value) => setMuscles({
                           muscle: muscleValue?.muscle,
                           percent: parseInt(value)
                       })}/>
            <Button
                onPress={() => {
                    onDelete(muscleValue)
                }}>Remove</Button>
        </View>)
}
export default MusclePicker;
