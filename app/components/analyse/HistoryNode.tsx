import DateRangePicker, {Range} from '../picker/date/DateRangePicker';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import WorkoutView from '../Workout/show/WorkoutDoneList';
import {Divider, Text} from 'react-native-paper';
import {View} from 'react-native';
import {repetitionMax} from '../../utils/AnalyseUtils';
import React, {memo} from 'react';
import {Muscles} from '../../models/Muscles';
import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import {Exercise} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';

interface HisotryNodeProps {
  range: Range;
  setRange: (range: Range) => void;
  exercise: Exercise[];
  muscle: Muscles[];
}

const HistoryNode = ({range, setRange, exercise, muscle}: HisotryNodeProps) => {
  let exercisesByMuscle = useExercisesForMuscles(muscle);
  let exercises = [...exercise, ...exercisesByMuscle];
  let lastWorkouts = useWorkoutsIn(range).filter((workout: Workout) => (exercises.length > 0 ? exercises.map((it) => it.id).includes(workout.exerciseId) : true));
  return (
    <>
      <DateRangePicker range={range} setRange={setRange} />
      <WorkoutView workoutIds={lastWorkouts.map((workout) => workout.id).filter((workoutId) => workoutId !== undefined) as number[]} />
      <Divider />
      <View>
        <Text>
          Volume:{' '}
          {lastWorkouts.reduce<number>(
            (previousValue: number, currentValue) => previousValue + currentValue.sets.reduce<number>((previousValue1, currentValue1) => previousValue1 + currentValue1.reps * currentValue1.weight, 0),
            0,
          )}{' '}
          kg
        </Text>
        <Text>1RM: {lastWorkouts.length > 0 ? repetitionMax(...lastWorkouts.flatMap((value) => value.sets)).toFixed(2) : 0} kg</Text>
      </View>
    </>
  );
};

export default memo(HistoryNode, (prevProps, nextProps) => {
  const b = prevProps.range.endDate.getTime() === nextProps.range.endDate.getTime() && nextProps.range.startDate.getTime() === prevProps.range.startDate.getTime();
  const b1 = prevProps.exercise.length === nextProps.exercise.length;
  const b2 = prevProps.muscle.length === nextProps.muscle.length;
  return b && b1 && b2;
});
