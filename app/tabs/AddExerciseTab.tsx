import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {addSetToTraining} from '../redux/Exercises/addSetToTraining';
import {bindActionCreators, Dispatch} from 'redux';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/rootRouter';
import {connect} from 'react-redux';
import {GlobalState} from '../redux/rootReducer';
import {TextInput, Text, Button, useTheme} from 'react-native-paper';

const AddExerciseTab = (props: Props & OwnProps) => {
  const [setCount, setSetCount] = useState(1);
  const [weight, setWeight] = useState<number>(0);
  const [rir, setRPE] = useState<number>(0);
  const [reps, setReps] = useState<number>(0);
  const [sets, setTrainings] = useState<WorkoutSet[]>([]);
  const theme = useTheme();
  const today = new Date();
  return (
    <ScrollView style={{backgroundColor: theme.colors.background}}>
      <View style={{alignSelf: 'center'}}>
        <Text style={{alignSelf: 'center'}}> Set {setCount}</Text>
        <TextInput mode="flat" label="Weight" value={weight.toString()} style={styles.textInput} onChangeText={(value) => setWeight(Number.parseFloat(value))} keyboardType="numeric" />
        <TextInput mode="flat" label="RIR" value={rir.toString()} style={styles.textInput} onChangeText={(value) => setRPE(Number.parseFloat(value))} keyboardType="numeric" />
        <TextInput mode="flat" label="Reps" value={reps.toString()} style={styles.textInput} onChangeText={(value) => setReps(Number.parseFloat(value))} keyboardType="numeric" />
      </View>
      <Button
        style={styles.textInput}
        onPress={() => {
          sets.push({date: today, weight, reps, rir} as WorkoutSet);
          setTrainings(sets);
          setSetCount(setCount + 1);
        }}>
        Add
      </Button>
      <View>
        {sets.map((training) => (
          <Text>
            {training.reps}@{training.weight} rir {training.rir}
          </Text>
        ))}
      </View>
      <Button
        onPress={() => {
          props.addSetToTraining({sets: sets, notes: ''}, props.route.params.exercise);
          props.navigation.navigate({name: 'Exercises', params: undefined});
        }}>
        Add Workout
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  textInput: {
    height: 50,
    width: 80,
    alignSelf: 'center',
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'AddExerciseTab'>;

const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      addSetToTraining,
    },
    dispatch,
  );

const mapStateToProps = (state: GlobalState) => {
  const {exercises} = state;
  return {exercises};
};

interface OwnProps {
  addSetToTraining: typeof addSetToTraining;
}

export default connect(mapStateToProps, mapDispatchToProps)(AddExerciseTab);
