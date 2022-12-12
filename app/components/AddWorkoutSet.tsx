import {StyleSheet, View} from "react-native";
import {Button, Text, TextInput} from "react-native-paper";
import React, {useState} from "react";


interface AddWorkoutProps {
    onAdd: (arg: WorkoutSet) => void,
    date: Date
}

const AddWorkoutSet = ({onAdd, date}: AddWorkoutProps) => {
    const [setCount, setSetCount] = useState(1);
    const [weight, setWeight] = useState('');
    const [rir, setRPE] = useState('');
    const [reps, setReps] = useState('');
    return (
        <View>
            <View style={{alignSelf: 'center'}}>
                <Text style={{alignSelf: 'center'}}> Set {setCount}</Text>
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
                    onAdd({
                        date: date,
                        weight: convertToNumber(weight),
                        reps: convertToNumber(reps),
                        rir: convertToNumber(rir)
                    } as WorkoutSet);
                    setSetCount(setCount + 1);
                }}>
                Add
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
