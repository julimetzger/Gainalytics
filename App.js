/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';
import Pressable from 'react-native/Libraries/Components/Pressable/Pressable';

const App: () => React$Node = () => {
  const exerciseList = [{name: 'Bankdrücken'}, {name: 'Squat'}, {name: 'Deadlift'}];
  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.text}>Exercises</Text>
        </View>
        {exerciseList.map((exercise) => (
          <Pressable onPress={() => console.log(exercise.name)}>
            <Text style={styles.exerciseText}> {exercise.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.dark,
  },
  text: {
    fontSize: 40,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.primary,
  },
  exerciseText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.primary,
  },
  header: {
    borderBottomColor: 'black',
    borderBottomWidth: 1,
  },
});

export default App;
