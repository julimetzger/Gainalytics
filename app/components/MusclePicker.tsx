import {View} from "react-native";
import DropDown from "react-native-paper-dropdown";
import {IconButton, TextInput, useTheme} from "react-native-paper";
import React, {useEffect, useState, useCallback, useMemo} from "react";
import {Muscles} from "../models/Muscles";
import {MusclePercentPair} from "../models/Exercise";

interface MusclePickerProps {
    muscleValue: MusclePercentPair,
    setMuscles: (muscles: MusclePercentPair) => void,
    onDelete: (muscle: MusclePercentPair) => void
}

const MusclePicker = React.memo(({setMuscles, muscleValue, onDelete}: MusclePickerProps) => {
    const [dropdownVisible, setDropdownVisible] = useState(false)
    let theme = useTheme();

    const muscleList = useMemo(() => 
        Object.values(Muscles).map((value: string) => ({
            label: value, 
            value: value
        })), []
    );

    const handleMuscleChange = useCallback((muscleUpdate: string) => {
        setMuscles({
            muscle: muscleUpdate as Muscles, 
            percent: muscleValue?.percent ?? 100
        });
    }, [setMuscles, muscleValue?.percent]);

    const handlePercentChange = useCallback((value: string) => {
        setMuscles({
            muscle: muscleValue?.muscle,
            percent: parseInt(value) || 0
        });
    }, [setMuscles, muscleValue?.muscle]);

    const handleDelete = useCallback(() => {
        onDelete(muscleValue);
    }, [onDelete, muscleValue]);

    const handleDropdownDismiss = useCallback(() => {
        setDropdownVisible(false);
    }, []);

    const handleDropdownShow = useCallback(() => {
        setDropdownVisible(true);
    }, []);

    useEffect(() => {
        // Cleanup effect
    }, [muscleValue]);

    return (
        <View style={{display: 'flex', flexDirection: 'row'}}>
            <DropDown
                label={'Muscle'}
                mode="outlined"
                inputProps={{width: 100}}
                visible={dropdownVisible}
                onDismiss={handleDropdownDismiss}
                showDropDown={handleDropdownShow}
                value={muscleValue?.muscle}
                setValue={handleMuscleChange}
                list={muscleList}
            />
            <TextInput 
                keyboardType="numeric"
                inputMode={"numeric"}
                label={'Involvement'}
                mode="outlined"
                defaultValue={"100"}
                style={{width: 90}}
                selectTextOnFocus={true}
                right={<TextInput.Icon icon="percent" size={18}/>}
                value={muscleValue?.percent?.toString()}
                onChangeText={handlePercentChange}
            />
            <IconButton
                size={28}
                icon={"close-circle"}
                iconColor={theme.colors.tertiaryContainer}
                onPress={handleDelete}
            />
        </View>
    )
});

MusclePicker.displayName = 'MusclePicker';

export default MusclePicker;
