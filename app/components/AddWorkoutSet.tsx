import {Keyboard, StyleSheet, View} from "react-native";
import {Button, IconButton, Text, TextInput, ToggleButton, Tooltip, useTheme} from "react-native-paper";
import React, {useEffect, useState} from "react";
import {repetitionWeightByOneRm} from "../utils/RepetitionMaxHelper";
import {WorkoutSet} from "../models/WorkoutSet";
import {useSettings} from "../redux/settings/useSettings";

interface AddWorkoutProps {
    onSubmit: (arg: WorkoutSet) => void,
    workoutSet?: WorkoutSet,
    oneRepMax?: number,
    onDelete?: (arg: WorkoutSet) => void,
    hasToSaveManually?: boolean,
    isPlanningMode?: boolean
}

const AddWorkoutSet = ({
                           onSubmit,
                           workoutSet,
                           oneRepMax,
                           onDelete,
                           hasToSaveManually = false,
                           isPlanningMode = false
                       }: AddWorkoutProps) => {
    let theme = useTheme();
    const [weight, setWeight] = useState(workoutSet?.weight?.toString() ?? '');
    const [rir, setRPE] = useState(workoutSet?.rir?.toString() ?? '0');
    const [reps, setReps] = useState(workoutSet?.reps?.toString() ?? '');
    const [editing, setEditing] = useState(hasToSaveManually);
    let appSettings = useSettings();
    const [disable1RMWeightCalculation, setDisable1RMWeightCalculation] = useState(appSettings.toggles?.disable1RMButton);
    const [highlightWeightSuggestion, setHighlightWeightSuggestion] = useState(false);
    const [weightEmpty, setWeightEmpty] = useState(false);
    const [rirEmpty, setRirEmpty] = useState(false);
    const [repsEmpty, setRepsEmpty] = useState(false);

    useEffect(() => {
        if (workoutSet !== undefined) {
            setWeight(workoutSet.weight?.toString() ?? '');
            setRPE(workoutSet.rir?.toString() ?? '0');
            setReps(workoutSet.reps?.toString() ?? '');
        }
    }, [workoutSet]);

    const setWeightOnChange = (value: string) => {
        setWeightEmpty(false);
        setDisable1RMWeightCalculation(true);
        setWeight(ensureFormat(value))
    }

    const setRIROnChange = (value: string) => {
        setRirEmpty(false);
        reps !== '' ? setWeightByOtherFields(convertToNumber(reps), convertToNumber(value)) : 0;
        setRPE(ensureFormat(value))
    }

    function setWeightByOtherFields(reps: number, rir: number) {
        if (isNaN(reps) || isNaN(rir)) {
            return;
        }
        if (oneRepMax !== undefined && !disable1RMWeightCalculation) {
            setWeightEmpty(false);
            let weight = repetitionWeightByOneRm(reps, rir, oneRepMax!!).toFixed(0);
            setWeight(weight.toString())
        }
    }

    const setRepsOnChange = (value: string) => {
        setRepsEmpty(false);
        rir === '' ? setWeightByOtherFields(convertToNumber(value), 0) : 0;
        rir !== '' ? setWeightByOtherFields(convertToNumber(value), convertToNumber(rir)) : 0;
        setReps(ensureFormat(value))
    }

    function setWeightSuggestions() {
        if (!disable1RMWeightCalculation) {
            setHighlightWeightSuggestion(true);
        }
    }

    function persisted() {
        return workoutSet?.date !== undefined;
    }

    function determineCheckmarkColor() {
        if (persisted() && !editing) {
            return "#558b2f";
        } else {
            return theme.colors.secondaryContainer;
        }
    }

    function submit() {
        if (weight === '' || reps === '' || rir === '') {
            weight === '' && setWeightEmpty(true);
            reps === '' && setRepsEmpty(true);
            rir === '' && setRirEmpty(true);
            return;
        }
        if (weight === NaN.toString() || reps === NaN.toString() || rir === NaN.toString()) {
            weight === NaN.toString() && setWeightEmpty(true);
            reps === NaN.toString() && setRepsEmpty(true);
            rir === NaN.toString() && setRirEmpty(true);
            return;
        }
        if (weight === undefined || reps === undefined || rir === undefined) {
            weight === undefined && setWeightEmpty(true);
            reps === undefined && setRepsEmpty(true);
            rir === undefined && setRirEmpty(true);
            return;
        }
        onSubmit({
            index: workoutSet?.index,
            date: new Date(Date.now()),
            weight: convertToNumber(weight),
            reps: convertToNumber(reps),
            rir: Number.isNaN(convertToNumber(rir)) ? 0 : convertToNumber(rir)
        } as WorkoutSet);
        setEditing(false);
    }

    function submitOnChangeIfAllowed() {
        if (persisted() && !hasToSaveManually) {
            submit();
        }
    }

    return (
        <View style={{margin: 5}}>
            <View style={{flexDirection: "row"}}>
                <TextInput mode="outlined" label="Reps" value={reps.toString()} style={styles.textInput}
                           onChangeText={setRepsOnChange} keyboardType="numeric"
                           onFocus={() => {
                               setEditing(true)
                               setWeightSuggestions()
                           }}
                           onBlur={() => {
                               setHighlightWeightSuggestion(false)
                               submitOnChangeIfAllowed();
                           }}
                           error={repsEmpty}
                           selectTextOnFocus={true}/>
                <TextInput mode="outlined" label="RIR" value={rir.toString()} style={styles.textInput}
                           onChangeText={setRIROnChange} keyboardType="numeric"
                           onFocus={() => {
                               setEditing(true)
                               setWeightSuggestions()
                           }}
                           onBlur={() => {
                               setHighlightWeightSuggestion(false)
                               submitOnChangeIfAllowed();
                           }}
                           error={rirEmpty}
                           selectTextOnFocus={true}/>
                <TextInput mode="outlined" label="Weight" value={weight.toString()} style={styles.textInput}
                           onChangeText={setWeightOnChange} keyboardType="numeric"
                           textColor={highlightWeightSuggestion && !disable1RMWeightCalculation ? theme.colors.secondary : undefined}
                           outlineColor={highlightWeightSuggestion && !disable1RMWeightCalculation ? theme.colors.secondary : undefined}
                           onFocus={() => {
                               setEditing(true)
                           }}
                           onBlur={() => {
                               submitOnChangeIfAllowed()
                           }}
                           error={weightEmpty}
                           selectTextOnFocus={true}/>
                {oneRepMax ? 
                    <Tooltip 
                        enterTouchDelay={300}
                        title={"Suggests weight based on your 1 rep max"}>
                    <ToggleButton
                        icon={() => <Text style={{color: theme.colors.onSecondaryContainer}}>1RM</Text>}
                        iconColor={theme.colors.secondaryContainer}
                        status={!disable1RMWeightCalculation ? "checked" : "unchecked"}
                        onPress={() => {
                            setDisable1RMWeightCalculation(prevState => !prevState);
                            setWeightByOtherFields(convertToNumber(reps), convertToNumber(rir));
                        }}
                    />
                </Tooltip> : null}
                {!isPlanningMode && (
                    <>
                        {persisted() && !editing &&
                            <IconButton icon={"check"} iconColor={determineCheckmarkColor()}/>}
                        {persisted() && editing &&
                            <IconButton icon={"check-circle"} iconColor={determineCheckmarkColor()} onPress={() => {
                                submit();
                                Keyboard.dismiss();
                            }}/>}
                        {!persisted() && workoutSet !== undefined &&
                            <IconButton icon={"check-circle"} iconColor={determineCheckmarkColor()} onPress={() => {
                                submit();
                                Keyboard.dismiss();
                            }}/>}
                    </>
                )}
                {!persisted() && workoutSet === undefined &&
                    <Button
                        mode={'contained'}
                        style={{marginStart: 5}}
                        buttonColor={theme.colors.primaryContainer}
                        textColor={theme.colors.onPrimaryContainer}
                        onPress={() => {
                            submit();
                            Keyboard.dismiss();
                        }}>
                        {"Add"}
                    </Button>}
                {(persisted() || (!persisted() && workoutSet !== undefined)) && onDelete !== undefined &&
                    <IconButton icon={"close-circle"} iconColor={theme.colors.tertiaryContainer}
                                onPress={() => onDelete(workoutSet!!)}/>}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    textInput: {
        height: 35,
        marginEnd: 5,
        width: 80,
        alignSelf: 'center',
    }
});

function convertToNumber(value: string) {
    return Number.parseFloat(value);
}

function ensureFormat(value: string): string {
    return value.replace(',', '.');
}

export default AddWorkoutSet;
