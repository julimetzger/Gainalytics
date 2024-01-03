import {Keyboard, StyleSheet, View} from "react-native";
import {Button, IconButton, Text, TextInput, ToggleButton, Tooltip, useTheme} from "react-native-paper";
import React, {useState} from "react";
import {repetionWeightByOneRm} from "../utils/RepetitionMaxHelper";


interface AddWorkoutProps {
    onSubmit: (arg: WorkoutSet) => void,
    workoutSet?: WorkoutSet,
    oneRepMax?: number,
    onDelete?: (arg: WorkoutSet) => void,
    hasToSaveManually?: boolean
}

// TODO do not show 1RM logic id oneRepMax is not set
const AddWorkoutSet = ({onSubmit, workoutSet, oneRepMax, onDelete, hasToSaveManually = false}: AddWorkoutProps) => {
    let theme = useTheme();
    const [weight, setWeight] = useState(workoutSet?.weight?.toString() ?? '');
    const [rir, setRPE] = useState(workoutSet?.rir?.toString() ?? '0');
    const [reps, setReps] = useState(workoutSet?.reps?.toString() ?? '');
    const [editing, setEditing] = useState(hasToSaveManually);
    const [weightSet, setWeightSet] = useState(false);
    const [highlightWeightSuggestion, setHighlightWeightSuggestion] = useState(false);
    const [weightEmpty, setWeightEmpty] = useState(false);
    const [rirEmpty, setRirEmpty] = useState(false);
    const [repsEmpty, setRepsEmpty] = useState(false);

    const setWeightOnChange = (value: string) => {
        setWeightEmpty(false);
        setWeightSet(true);
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
        if (oneRepMax !== null && !weightSet) {
            setWeightEmpty(false);
            let weight = repetionWeightByOneRm(reps, rir, oneRepMax!!).toFixed();
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
        if (!weightSet) {
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
            return theme.colors.primaryContainer;
        }
    }

    function submit() {
        if (weight === '' || reps === '' || rir === '') {
            weight === '' && setWeightEmpty(true);
            reps === '' && setRepsEmpty(true);
            rir === '' && setRirEmpty(true);
            return;
        }
        onSubmit({
            index: workoutSet?.index,
            date: new Date(Date.now()),
            weight: convertToNumber(weight),
            reps: convertToNumber(reps),
            rir: convertToNumber(rir) == NaN ? 0 : convertToNumber(rir)
        } as WorkoutSet);
    }

    function submitOnChangeIfAllowed() {
        if (persisted() && !hasToSaveManually) {
            submit();
            setEditing(false);
        }
    }

    return (
        <View style={{justifyContent: 'space-between', margin: 5}}>
            <View style={{alignSelf: 'center', flexDirection: "row"}}>
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
                           selectTextOnFocus={true}
                />
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
                           textColor={highlightWeightSuggestion && !weightSet ? theme.colors.secondary : undefined}
                           outlineColor={highlightWeightSuggestion && !weightSet ? theme.colors.secondary : undefined}
                           onFocus={() => {
                               setEditing(true)
                           }}
                           onBlur={() => {
                               submitOnChangeIfAllowed()
                           }}
                           error={weightEmpty}
                           selectTextOnFocus={true}/>
                <Tooltip
                    title={"Suggests the weight based on your 1RM"}>
                    <ToggleButton
                        icon={() => <View><Text
                            style={{color: theme.colors.onSecondaryContainer}}>1RM</Text></View>}
                        iconColor={theme.colors.secondaryContainer}
                        status={!weightSet ? "checked" : "unchecked"}
                        onPress={() => {
                            setWeightSet(prevState => !prevState);
                            setWeightByOtherFields(convertToNumber(reps), convertToNumber(rir));
                        }}/>
                </Tooltip>
                {persisted() && !editing &&
                    <IconButton icon={"check"} iconColor={determineCheckmarkColor()}/>}
                {persisted() && editing &&
                    <IconButton icon={"check-circle"} iconColor={determineCheckmarkColor()} onPress={() => {
                        submit();
                        Keyboard.dismiss();
                    }}/>}
                {!persisted() &&
                    <Button
                        mode={'contained'}
                        style={{marginStart: 5}}
                        buttonColor={theme.colors.primaryContainer}
                        textColor={theme.colors.onPrimaryContainer}
                        onPress={submit}>
                        {workoutSet !== undefined ? "Update" : "Add"}
                    </Button>}
                {persisted() && onDelete !== undefined &&
                    <IconButton icon={"delete"} iconColor={theme.colors.secondary}
                                onPress={() => onDelete(workoutSet!!)}/>}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    textInput: {
        height: 35,
        marginEnd: 5,
        width:
            75,
        alignSelf:
            'center',
    }
});

function convertToNumber(value: string) {
    return Number.parseFloat(value);
}

function ensureFormat(value: string): string {
    return value.replace(',', '.');
}

export default AddWorkoutSet;
