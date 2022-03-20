import React, {useState} from 'react';
import {Button, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import NumericInput from 'react-native-numeric-input';
import {addSetToTraining} from '../reduxStates/Exercises/exercisesActions';
import {bindActionCreators, Dispatch} from 'redux';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/rootRouter';
import {connect} from 'react-redux';
import {GlobalState} from '../reduxStates/rootReducer';

const AddExerciseTab = (props: Props & OwnProps) => {
  const [setCount, setSetCount] = useState(1);
  const [weight, setWeight] = useState<number>(1);
  const [rir, setRPE] = useState<number>(1);
  const [reps, setReps] = useState<number>(1);
  const [sets, setTrainings] = useState<WorkoutSet[]>([]);
  const today = new Date();
  return (
    <ScrollView>
      <View style={{alignSelf: 'center'}}>
        <Text style={{alignSelf: 'center'}}> Set {setCount}</Text>
        <View style={{flexDirection: 'row'}}>
          <Text>Weight</Text>
          <NumericInput valueType="real" value={weight} onChange={(value) => setWeight(value)} />
        </View>
        <TextInput placeholder="RPE" value={rir.toString()} style={styles.textInput} onChangeText={(value) => setRPE(Number.parseFloat(value))} keyboardType="numeric" />
        <TextInput placeholder="Reps" value={reps.toString()} style={styles.textInput} onChangeText={(value) => setReps(Number.parseFloat(value))} keyboardType="numeric" />
      </View>
      <Button
        title="Add"
        onPress={() => {
          sets.push({date: today, weight, reps, rir} as WorkoutSet);
          setTrainings(sets);
          setSetCount(setCount + 1);
        }}
      />
      <View>
        {sets.map((training) => (
          <Text>
            {training.reps}@{training.weight} rpe {training.rir}
          </Text>
        ))}
      </View>
      <Button
        title="Add Workout"
        onPress={() => {
          props.addSetToTraining({sets: sets, notes: ''}, props.route.params.exercise);
          props.navigation.navigate({name: 'Exercises', params: undefined});
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  textInput: {
    height: 40,
    width: 80,
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
