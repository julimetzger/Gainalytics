import React from 'react';
import WorkoutView from '../../Workout/show/WorkoutDoneList';
import {View} from 'react-native';
import {Training} from '../../../models/entities/Training';

interface Props {
  training: Training;
}

const TrainingHistory = ({training}: Props) => {
  return <View>{training.doneWorkoutIds && <WorkoutView workoutIds={Object.values(training.doneWorkoutIds)} />}</View>;
};
export default TrainingHistory;
