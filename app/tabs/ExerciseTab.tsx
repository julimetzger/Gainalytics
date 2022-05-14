import React from 'react';
import {Pressable, ScrollView, StyleSheet} from 'react-native';
import {ExerciseState, GlobalState} from '../redux/rootReducer';
import {connect} from 'react-redux';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../routing/rootRouter';
import {Divider, useTheme, Text} from 'react-native-paper';

const ExerciseTab = ({navigation, exercises}: Props & ExerciseState) => {
  const theme = useTheme();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{backgroundColor: theme.colors.background}}>
      {exercises.map((exercise) => (
        <Pressable key={exercise.name} onPress={() => navigation.navigate({name: 'AddExerciseTab', params: {exercise: exercise}})}>
          <Text style={styles.exerciseText}> {exercise.name}</Text>
          <Divider />
        </Pressable>
      ))}
    </ScrollView>
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
