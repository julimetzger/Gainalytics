import {StyleSheet, View} from "react-native";
import {Button, Switch, TextInput, useTheme} from "react-native-paper";
import React, {useState} from "react";
import {repetionWeightByOneRm} from "../utils/RepetitionMaxHelper";


interface AddWorkoutProps {
    onSubmit: (arg: WorkoutSet) => void,
    workoutSet?: WorkoutSet,

    oneRepMax?: number,
}


const AddWorkoutSet = ({onSubmit, workoutSet, oneRepMax}: AddWorkoutProps) => {
    let theme = useTheme();
    const [weight, setWeight] = useState(workoutSet?.weight.toString() ?? '');
    const [rir, setRPE] = useState(workoutSet?.rir.toString() ?? '0');
    const [reps, setReps] = useState(workoutSet?.reps.toString() ?? '');
    const [weightSet, setWeightSet] = useState(false);
    const [highlightWeightSuggestion, setHighlightWeightSuggestion] = useState(false);
    const [idForUpdates, setIdForUpdates] = useState(1);

    const setWeightOnChange = (value: string) => {
        setWeightSet(true);
        setWeight(ensureFormat(value))
    }

    const setRIROnChange = (value: string) => {
        reps !== '' ? setWeightByOtherFields(convertToNumber(reps), convertToNumber(value)) : 0;
        setRPE(ensureFormat(value))
    }

    function setWeightByOtherFields(reps: number, rir: number) {
        if (isNaN(reps) || isNaN(rir)) {
            return;
        }
        if (oneRepMax !== null && !weightSet) {
            let weight = repetionWeightByOneRm(reps, rir, oneRepMax!!).toFixed();
            setWeight(weight.toString())
        }
    }

    const setRepsOnChange = (value: string) => {
        rir === '' ? setWeightByOtherFields(convertToNumber(value), 0) : 0;
        rir !== '' ? setWeightByOtherFields(convertToNumber(value), convertToNumber(rir)) : 0;
        setReps(ensureFormat(value))
    }

    function setWeightSuggestions() {
        if (!weightSet) {
            setHighlightWeightSuggestion(true);
        }
    }

    return (
        <View>
            <View style={{alignSelf: 'center'}}>
                <TextInput mode="flat" label="Reps" value={reps.toString()} style={styles.textInput}
                           onChangeText={setRepsOnChange} keyboardType="numeric"
                           onFocus={() => setWeightSuggestions()}
                           onBlur={() => setHighlightWeightSuggestion(false)}/>
                <TextInput mode="flat" label="RIR" value={rir.toString()} style={styles.textInput}
                           onChangeText={setRIROnChange} keyboardType="numeric"/>
                <TextInput mode="flat" label="Weight" value={weight.toString()} style={styles.textInput}
                           onChangeText={setWeightOnChange} keyboardType="numeric"
                           underlineColor={highlightWeightSuggestion && !weightSet ? theme.colors.accent : theme.colors.disabled}/>
            </View>
            <Switch style={styles.update}
                    value={!weightSet}
                    onValueChange={() => {
                        setWeightSet(prevState => !prevState);
                        setWeightByOtherFields(convertToNumber(reps), convertToNumber(rir));
                    }}/>
            <Button
                style={styles.textInput}
                disabled={weight === '' || reps === '' || rir === ''}
                onPress={() => {
                    onSubmit({
                        index: workoutSet?.index ?? idForUpdates,
                        date: new Date(Date.now()),
                        weight: convertToNumber(weight),
                        reps: convertToNumber(reps),
                        rir: convertToNumber(rir) == NaN ? 0 : convertToNumber(rir)
                    } as WorkoutSet);
                    setIdForUpdates(idForUpdates + 1)
                }}>
                {workoutSet !== undefined ? "Update" : "Add"}
            </Button>
        </View>
    )
}

const styles = StyleSheet.create({
    textInput: {
        height: 50,
        width: 80,
        alignSelf: 'center',
    },
    update: {
        position: "absolute",
        top: 110,
        right: 85
    }
});

function convertToNumber(value: string) {
    return Number.parseFloat(value);
}

function ensureFormat(value: string): string {
    return value.replace(',', '.');
}

export default AddWorkoutSet;
