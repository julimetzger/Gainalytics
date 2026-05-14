import React, {useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import WorkoutDoneList from '../../components/Workout/show/WorkoutDoneList';
import {useAllFinishedWorkoutIds} from '../../redux/Workout/use/useAllFinishedWorkoutIds';

const PAGE_SIZE = 20;

const History = () => {
  const allIds = useAllFinishedWorkoutIds();
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const visibleIds = allIds.slice(0, pageSize);

  const loadMore = () => {
    if (pageSize < allIds.length) {
      setPageSize(prev => Math.min(prev + PAGE_SIZE, allIds.length));
    }
  };

  if (allIds.length === 0) {
    return (
      <View testID="history-empty-state" style={styles.empty}>
        <Text>Noch keine Trainings vorhanden.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="history-list-container"
      style={styles.container}
      onScroll={({nativeEvent}) => {
        const {layoutMeasurement, contentOffset, contentSize} = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
          loadMore();
        }
      }}
      scrollEventThrottle={400}
    >
      <WorkoutDoneList
        workoutIds={visibleIds}
        editable={false}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default History;
