import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {FlashList} from '@shopify/flash-list';
import {useRoute, RouteProp} from '@react-navigation/native';
import WorkoutViewTile from '../../components/Workout/show/WorkoutView';
import {getDateStringFromDate} from '../../utils/DateHelper';
import {useDateWorkoutMapByIds} from '../../redux/Workout/use/useDateWorkoutMapByIds';
import {useWorkoutsByFilters} from '../../redux/Workout/use/useWorkoutsByFilters';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';
import {Muscles} from '../../models/Muscles';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import HistoryFiltersSection from '../../components/analyse/HistoryFiltersSection';

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

const EMPTY_MUSCLES: Muscles[] = [];
const EMPTY_EXERCISE_IDS: number[] = [];

const History = () => {
  const theme = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'History'>>();
  // Dashboard drill-down (DashboardTab.handleExercisePress) navigates here with
  // an `exercise` param; pre-select that exercise's chip so the list is filtered
  // to that exercise on mount, while still allowing further toggling.
  const routeExercise = route.params?.exercise;

  const [selectedMuscles, setSelectedMuscles] = useState<Muscles[]>(EMPTY_MUSCLES);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<number[]>(() =>
    routeExercise?.id !== undefined ? [routeExercise.id] : EMPTY_EXERCISE_IDS,
  );
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const allIds = useWorkoutsByFilters(selectedMuscles, selectedExerciseIds);
  const allExercises = useAlleExercises();

  const sortedExercises = useMemo(
    () => [...allExercises].sort((a, b) => a.name.localeCompare(b.name)),
    [allExercises],
  );

  // Reset pagination to the first page whenever filters change.
  useEffect(() => {
    setPageSize(PAGE_SIZE);
  }, [selectedMuscles, selectedExerciseIds]);

  const totalActiveFilters = selectedMuscles.length + selectedExerciseIds.length;

  const filterSummary =
    totalActiveFilters > 0
      ? `Filters · ${totalActiveFilters}`
      : 'No filters active';

  const onToggleMuscle = useCallback((muscle: Muscles) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
  }, []);

  const onToggleExercise = useCallback((exerciseId: number) => {
    setSelectedExerciseIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId],
    );
  }, []);

  const onToggleExpanded = useCallback(() => setFilterExpanded((prev) => !prev), []);

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
          <WorkoutViewTile workoutId={item.workoutId} editable={true} />
        </View>
      ),
    [theme],
  );

  // True empty state: no workouts exist at all and no filters are set.
  if (allIds.length === 0 && totalActiveFilters === 0) {
    return (
      <View testID="history-empty-state" style={styles.empty}>
        <Text>No workouts yet.</Text>
      </View>
    );
  }

  return (
    <View testID="history-list-container" style={styles.container}>
      <HistoryFiltersSection
        expanded={filterExpanded}
        summary={filterSummary}
        selectedMuscles={selectedMuscles}
        selectedExerciseIds={selectedExerciseIds}
        exercises={sortedExercises}
        onToggleExpanded={onToggleExpanded}
        onToggleMuscle={onToggleMuscle}
        onToggleExercise={onToggleExercise}
      />
      {allIds.length === 0 ? (
        <View testID="history-filters-empty" style={styles.filtersEmpty}>
          <Text>No workouts match the current filters.</Text>
        </View>
      ) : (
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
      )}
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
  filtersEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default History;
