import {StyleSheet, View} from "react-native";
import {Button, Switch, TextInput, Tooltip, useTheme} from "react-native-paper";
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

    return (
        <View>
            <View style={{alignSelf: 'center', flexDirection: "row"}}>
                <TextInput mode="flat" label="Reps" value={reps.toString()} style={styles.textInput}
                           onChangeText={setRepsOnChange} keyboardType="numeric"
                           onFocus={() => setWeightSuggestions()}
                           onBlur={() => setHighlightWeightSuggestion(false)}
                           error={repsEmpty}/>
                <TextInput mode="flat" label="RIR" value={rir.toString()} style={styles.textInput}
                           onChangeText={setRIROnChange} keyboardType="numeric"
                           error={rirEmpty}/>
                <TextInput mode="flat" label="Weight" value={weight.toString()} style={styles.textInput}
                           onChangeText={setWeightOnChange} keyboardType="numeric"
                           underlineColor={highlightWeightSuggestion && !weightSet ? theme.colors.tertiary : theme.colors.onSecondaryContainer}
                           error={weightEmpty}/>
            </View>
            <View style={styles.update}>
                <Tooltip
                    title={"Suggests the weight based on your desired reps and RIR, calculated using the 1RM from your last workout."}>
                    <Switch
                        value={!weightSet}
                        onValueChange={() => {
                            setWeightSet(prevState => !prevState);
                            setWeightByOtherFields(convertToNumber(reps), convertToNumber(rir));
                        }}/>
                </Tooltip>
            </View>
            <Button
                style={styles.textInput}
                onPress={() => {
                    if (weight === '' || reps === '' || rir === '') {
                        weight === '' && setWeightEmpty(true);
                        reps === '' && setRepsEmpty(true);
                        rir === '' && setRirEmpty(true);
                        return;
                    }
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
        top: 15,
        right: 20
    }
});

function convertToNumber(value: string) {
    return Number.parseFloat(value);
}

function ensureFormat(value: string): string {
    return value.replace(',', '.');
}

export default AddWorkoutSet;
