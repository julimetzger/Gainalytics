import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {ExerciseState, GlobalState} from '../redux/rootReducer';
import {connect} from 'react-redux';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/rootRouter';
import {Divider, useTheme, Text, TextInput} from 'react-native-paper';
import AddExercise from '../components/AddExercise';

const ExerciseTab = ({navigation, exercises}: Props & ExerciseState) => {
  const theme = useTheme();
  const [filter, setFilter] = useState('');

  return (
    <View style={{backgroundColor: theme.colors.background}}>
      <TextInput label={'Filter'} onChangeText={(text) => setFilter(text)} />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {exercises
          .filter((exercise) => exercise.name.toLowerCase().includes(filter.toLowerCase()))
          .map((exercise) => (
            <Pressable key={exercise.name} onPress={() => navigation.navigate({name: 'AddExerciseTab', params: {exercise: exercise}})}>
              <Text style={styles.exerciseText}> {exercise.name}</Text>
              <Divider />
            </Pressable>
          ))}
        <AddExercise />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  exerciseText: {
    fontSize: 20,
    textAlign: 'left',
    textAlignVertical: 'center',
  },
});

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;

const mapStateToProps = (state: GlobalState) => {
  const {exercises} = state;
  return exercises;
};

export default connect(mapStateToProps)(ExerciseTab);
