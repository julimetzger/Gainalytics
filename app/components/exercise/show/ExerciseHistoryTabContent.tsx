import React from 'react';
import {View} from 'react-native';
import {Exercise} from '../../../models/entities/Exercise';
import ExerciseHistory from './ExerciseHistory';

interface Props {
  exercise: Exercise;
}

const ExerciseHistoryTabContent = ({exercise}: Props) => (
  <View testID="exercise-history-tab" style={{flex: 1}}>
    <ExerciseHistory exercise={exercise} editable={true} />
  </View>
);

export default ExerciseHistoryTabContent;
