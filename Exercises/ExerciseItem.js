import React, {useState} from 'react';
import {Button, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import NumericInput from 'react-native-numeric-input';

const ExerciseItem = ({route}) => {
  const [setCount, setSetCount] = useState(1);
  const [weight, setWeight] = useState();
  const [RPE, setRPE] = useState();
  const [reps, setReps] = useState();
  return (
    <ScrollView>
      <View style={{alignSelf: 'center'}}>
        <Text style={{alignSelf: 'center'}}> Set {setCount}</Text>
        <View style={{flexDirection: 'row'}}>
          <Text>Weight</Text>
          <NumericInput label="Weight" valueType="real" value={weight} onChangeText={(value) => setWeight(value)} keyboardType="numeric" />
        </View>
        <TextInput placeholder="RPE" value={RPE} style={styles.textInput} onChangeText={(value) => setRPE(value)} keyboardType="numeric" />
        <TextInput placeholder="Reps" value={reps} style={styles.textInput} onChangeText={(value) => setReps(value)} keyboardType="numeric" />
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
export default ExerciseItem;
