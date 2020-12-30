import React from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import Pressable from 'react-native/Libraries/Components/Pressable/Pressable';
import {Colors} from 'react-native/Libraries/NewAppScreen';

const Exercise = ({navigation}) => {
  const exerciseList = [{name: 'Bankdrücken'}, {name: 'Squat'}, {name: 'Deadlift'}];
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
      {exerciseList.map((exercise) => (
        <Pressable onPress={() => navigation.navigate('ExerciseItem', {name: exercise.name})} style={styles.exerciseItem}>
          <Text style={styles.exerciseText}> {exercise.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.dark,
  },
  exerciseItem: {
    height: 40,
    borderBottomColor: 'black',
    borderBottomWidth: 1,
  },
  text: {
    alignContent: 'center',
    fontSize: 40,
    textAlign: 'center',
    color: Colors.primary,
  },
  exerciseText: {
    fontSize: 20,
    textAlign: 'left',
    textAlignVertical: 'center',
    color: Colors.primary,
  },
  header: {
    backgroundColor: Colors.light,
    borderBottomColor: 'black',
    borderBottomWidth: 0,
  },
});

export default Exercise;
