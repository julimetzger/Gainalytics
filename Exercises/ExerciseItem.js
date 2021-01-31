import React, {useState} from 'react';
import {Button, ScrollView, Text, TextInput, View, StyleSheet} from 'react-native';
import NumericInput from 'react-native-numeric-input';
import {addSetToTraining} from '../reduxStates/Exercises/exercisesActions';
import {bindActionCreators} from 'redux';
import connect from 'react-redux/lib/connect/connect';

const ExerciseItem = ({route, addSetToTraining, exercises}) => {
  const [setCount, setSetCount] = useState(1);
  const [weight, setWeight] = useState();
  const [rpe, setRPE] = useState();
  const [reps, setReps] = useState();
  const trainings = exercises.exercises.find((exercise) => exercise.name === route.params.name).trainings;
  const today = new Date().toLocaleDateString();
  return (
    <ScrollView>
      <View style={{alignSelf: 'center'}}>
        <Text style={{alignSelf: 'center'}}> Set {setCount}</Text>
        <View style={{flexDirection: 'row'}}>
          <Text>Weight</Text>
          <NumericInput label="Weight" valueType="real" value={weight} onChange={(value) => setWeight(value)} keyboardType="numeric" />
        </View>
        <TextInput placeholder="RPE" value={rpe} style={styles.textInput} onChangeText={(value) => setRPE(value)} keyboardType="numeric" />
        <TextInput placeholder="Reps" value={reps} style={styles.textInput} onChangeText={(value) => setReps(value)} keyboardType="numeric" />
      </View>
      <Button
        title="Add"
        onPress={() => {
          addSetToTraining(today, {name: route.params.name, weight, reps, rpe});
          setSetCount(setCount + 1);
        }}
      />
      <View>
        {trainings.map((training) => (
          <Text>
            {training.reps}@{training.weight} rpe {training.rpe}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  textInput: {
    height: 40,
    width: 80,
  },
});

const mapDispatchToProps = (dispatch) =>
  bindActionCreators(
    {
      addSetToTraining,
    },
    dispatch,
  );

const mapStateToProps = (state) => {
  const {exercises} = state;
  return {exercises};
};

export default connect(mapStateToProps, mapDispatchToProps)(ExerciseItem);
