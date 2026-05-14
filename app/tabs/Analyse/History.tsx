import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {FlashList} from '@shopify/flash-list';
import WorkoutViewTile from '../../components/Workout/show/WorkoutView';
import {getDateStringFromDate} from '../../utils/DateHelper';
import {useDateWorkoutMapByIds} from '../../redux/Workout/use/useDateWorkoutMapByIds';
import {useAllFinishedWorkoutIds} from '../../redux/Workout/use/useAllFinishedWorkoutIds';

const PAGE_SIZE = 20;

export type HistoryRow =
  | {type: 'header'; key: string; date: Date}
  | {type: 'workout'; key: string; workoutId: number};

// Flatten the date->workoutIds map into a single typed-item list so FlashList
// can virtualize each row independently. Nesting variable-height date-group
// cards inside one FlashList item breaks recycling; separate header/workout
// rows with getItemType keep virtualization intact.
export const buildHistoryRows = (dateWorkoutMap: Map<Date, number[]>): HistoryRow[] => {
  const rows: HistoryRow[] = [];
  dateWorkoutMap.forEach((workoutIds, date) => {
    rows.push({type: 'header', key: `header-${new Date(date).getTime()}`, date});
    workoutIds.forEach((workoutId) => {
      rows.push({type: 'workout', key: `workout-${workoutId}`, workoutId});
    });
  });
  return rows;
};

const History = () => {
  const theme = useTheme();
  const allIds = useAllFinishedWorkoutIds();
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Client-side pagination: only the first `pageSize` ids are grouped and
  // rendered. Scrolling near the end grows the window by one PAGE_SIZE batch.
  const visibleIds = useMemo(() => allIds.slice(0, pageSize), [allIds, pageSize]);
  const dateWorkoutMap = useDateWorkoutMapByIds(visibleIds);
  const rows = useMemo(() => buildHistoryRows(dateWorkoutMap), [dateWorkoutMap]);

  const loadMore = useCallback(() => {
    setPageSize((prev) => (prev < allIds.length ? Math.min(prev + PAGE_SIZE, allIds.length) : prev));
  }, [allIds.length]);

  const renderRow = useCallback(
    ({item}: {item: HistoryRow}) =>
      item.type === 'header' ? (
        <Text testID="history-date-header" style={[styles.dateText, {fontSize: theme.fonts.titleLarge.fontSize}]}>
          {getDateStringFromDate(new Date(item.date))}
        </Text>
      ) : (
        <View style={styles.workoutRow}>
          <WorkoutViewTile workoutId={item.workoutId} editable={false} />
        </View>
      ),
    [theme],
  );

  if (allIds.length === 0) {
    return (
      <View testID="history-empty-state" style={styles.empty}>
        <Text>Noch keine Trainings vorhanden.</Text>
      </View>
    );
  }

  return (
    <View testID="history-list-container" style={styles.container}>
      <FlashList
        testID="history-flash-list"
        data={rows}
        renderItem={renderRow}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.type}
        estimatedItemSize={120}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  dateText: {
    marginLeft: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  workoutRow: {
    marginHorizontal: 5,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default History;
