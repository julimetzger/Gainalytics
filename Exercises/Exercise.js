import React from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import Pressable from 'react-native/Libraries/Components/Pressable/Pressable';
import {Colors} from 'react-native/Libraries/NewAppScreen';
import connect from 'react-redux/lib/connect/connect';

const Exercise = ({navigation, exercises}) => {
  const exerciseList = exercises.exercises;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      {exerciseList.map((exercise) => (
        <Pressable key={exercise.name} onPress={() => navigation.navigate('Exercise', {name: exercise.name})} style={styles.exerciseItem}>
          <Text style={styles.exerciseText}> {exercise.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  exerciseItem: {
    height: 40,
    borderBottomColor: 'black',
    borderBottomWidth: 1,
  },
  exerciseText: {
    fontSize: 20,
    textAlign: 'left',
    textAlignVertical: 'center',
    color: Colors.primary,
  },
});

const mapStateToProps = (state) => {
  const {exercises} = state;
  return {exercises};
};

export default connect(mapStateToProps)(Exercise);
