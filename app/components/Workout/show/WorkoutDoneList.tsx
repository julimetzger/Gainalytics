import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {FlashList} from '@shopify/flash-list';
import WorkoutViewTile from './WorkoutView';
import {Metric} from '../../picker/elements/TrainingElementPicker';
import {getDateStringFromDate} from '../../../utils/DateHelper';
import {useDateWorkoutMapByIds} from '../../../redux/Workout/use/useDateWorkoutMapByIds';
import {useHighlightWorkout} from '../../../redux/Workout/use/useHighlightWorkout';

interface WorkoutViewProps {
  workoutIds: number[];
  highlightMode?: Metric;
  editable?: boolean;
  onEndReached?: () => void;
}

const WorkoutDoneList = ({workoutIds, highlightMode, editable = true, onEndReached}: WorkoutViewProps) => {
  const theme = useTheme();
  const dateWorkoutMap = useDateWorkoutMapByIds(workoutIds);
  const highlightWorkout = useHighlightWorkout(workoutIds, highlightMode);

  const renderWorkoutItem = ({item: [date, workouts]}: {item: [string, number[]]}) => (
    <Card mode="elevated" style={styles.dateCard} key={new Date(date).getTime()}>
      <Text style={[styles.dateText, {fontSize: theme.fonts.titleLarge.fontSize}]}>{getDateStringFromDate(new Date(date))}</Text>
      {workouts.map((workout) => (
        <WorkoutViewTile key={workout} workoutId={workout} highlightMode={highlightWorkout.includes(workout) ? highlightMode : undefined} editable={editable} />
      ))}
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={Array.from(dateWorkoutMap.entries())}
        renderItem={renderWorkoutItem}
        estimatedItemSize={250}
        onEndReached={onEndReached}
        scrollEnabled={false}
        keyboardShouldPersistTaps="always"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 20,
  },
  dateCard: {
    margin: 5,
    marginHorizontal: 5,
  },
  dateText: {
    marginLeft: 10,
  },
});

export default memo(WorkoutDoneList, (prevProps, nextProps) => {
  if (nextProps.highlightMode) {
    return false;
  }
  return prevProps.workoutIds.every((id) => nextProps.workoutIds.includes(id)) && nextProps.workoutIds.every((id) => prevProps.workoutIds.includes(id));
});
