import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/exerciseRouter';
import {Button, Text, TextInput, useTheme} from 'react-native-paper';
import {useDispatchAddSetToTraining} from '../redux/Workout/dispatchAddSetToTraining';
import WorkoutSetView from "./WorkoutSetView";

const AddExerciseTab = (props: Props) => {
  const [setCount, setSetCount] = useState(1);
  const [weight, setWeight] = useState('');
  const [rir, setRPE] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setTrainings] = useState<WorkoutSet[]>([]);
  let dispatchAddSetToTraining = useDispatchAddSetToTraining();
  const theme = useTheme();
  const today = new Date();
  return (
    <ScrollView style={{backgroundColor: theme.colors.background}}>
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
                sets.push({
                    date: today,
                    weight: convertToNumber(weight),
                    reps: convertToNumber(reps),
                    rir: convertToNumber(rir)
                } as WorkoutSet);
                setTrainings(sets);
                setSetCount(setCount + 1);
            }}>
            Add
        </Button>
        <WorkoutSetView sets={sets} />
        <Button
            onPress={() => {
                dispatchAddSetToTraining({sets: sets, notes: '', exerciseId: props.route.params.exercise.id});
                props.navigation.navigate({name: 'Exercises', params: undefined});
            }}>
            Add Workout
        </Button>
    </ScrollView>
  );
};

function convertToNumber(value: string) {
  return Number.parseFloat(value);
}

function ensureFormat(value: string): string {
  return value.replace(',', '.');
}

const styles = StyleSheet.create({
  textInput: {
    height: 50,
    width: 80,
    alignSelf: 'center',
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'AddExerciseTab'>;

export default AddExerciseTab;
