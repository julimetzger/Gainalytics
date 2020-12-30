import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Colors} from 'react-native/Libraries/NewAppScreen';

const ExerciseItem = ({navigation, route}) => {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.text}>{route.params.name}</Text>
      </View>
    </>
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

export default ExerciseItem;
