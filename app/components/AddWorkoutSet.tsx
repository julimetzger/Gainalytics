import {StyleSheet, View} from "react-native";
import {Button, TextInput} from "react-native-paper";
import React, {useState} from "react";


interface AddWorkoutProps {
    onSubmit: (arg: WorkoutSet) => void,
    workoutSet?: WorkoutSet
}

const AddWorkoutSet = ({onSubmit,  workoutSet}: AddWorkoutProps) => {
    const [weight, setWeight] = useState(workoutSet?.weight.toString() ?? '');
    const [rir, setRPE] = useState(workoutSet?.rir.toString() ?? '');
    const [reps, setReps] = useState(workoutSet?.reps.toString() ?? '');
    const [idForUpdates,setIdForUpdates]= useState(1);
    return (
        <View>
            <View style={{alignSelf: 'center'}}>

                <TextInput mode="flat" label="Weight" value={weight.toString()} style={styles.textInput}
                           onChangeText={(value) => setWeight(ensureFormat(value))} keyboardType="numeric"/>
                <TextInput mode="flat" label="RIR" value={rir.toString()} style={styles.textInput}
                           onChangeText={(value) => setRPE(ensureFormat(value))} keyboardType="numeric"/>
                <TextInput mode="flat" label="Reps" value={reps.toString()} style={styles.textInput}
                           onChangeText={(value) => setReps(ensureFormat(value))} keyboardType="numeric"/>
            </View>
            <Button
                style={styles.textInput}
                onPress={() => {
                    onSubmit({
                        index: workoutSet?.index ?? idForUpdates,
                        date: new Date(Date.now()),
                        weight: convertToNumber(weight),
                        reps: convertToNumber(reps),
                        rir: convertToNumber(rir)
                    } as WorkoutSet);
                    setIdForUpdates(idForUpdates+1)
                }}>
                {workoutSet!== undefined? "Update" : "Add"}
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
});

function convertToNumber(value: string) {
    return Number.parseFloat(value);
}

function ensureFormat(value: string): string {
    return value.replace(',', '.');
}

export default AddWorkoutSet;
