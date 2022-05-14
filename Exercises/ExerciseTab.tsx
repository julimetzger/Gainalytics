import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text} from 'react-native';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import {ExerciseState, GlobalState} from '../reduxStates/rootReducer';
import {connect} from 'react-redux';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/rootRouter';

const ExerciseTab = ({navigation, exercises}: Props & ExerciseState) => {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      {exercises.map((exercise) => (
        <Pressable key={exercise.name} onPress={() => navigation.navigate({name: 'AddExerciseTab', params: {exercise: exercise}})} style={styles.exerciseItem}>
          <Text style={styles.exerciseText}> {exercise.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  exerciseItem: {
    height: 40,
    borderBottomColor: Colors.primary,
    borderBottomWidth: 1,
  },
  exerciseText: {
    fontSize: 20,
    textAlign: 'left',
    textAlignVertical: 'center',
    color: Colors.primary,
  },
});

type Props = NativeStackScreenProps<RootStackParamList, 'Exercises'>;

const mapStateToProps = (state: GlobalState) => {
  const {exercises} = state;
  return exercises;
};

export default connect(mapStateToProps)(ExerciseTab);
