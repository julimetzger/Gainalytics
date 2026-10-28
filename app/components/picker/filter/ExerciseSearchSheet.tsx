import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Keyboard, ScrollView, StyleSheet, View} from 'react-native';
import {Button, Chip, Modal, Portal, Searchbar, Text, useTheme} from 'react-native-paper';
import {FlashList} from '@shopify/flash-list';
import {Exercise} from '../../../models/entities/Exercise';
import {useAlleExercises} from '../../../redux/Exercises/use/useAllExercises';
import {useExerciseTrainingStats} from '../../../redux/Workout/use/useExerciseTrainingStats';
import {filterExercisesByName, formatAgo, recentExercises, toggleExercise} from '../../../utils/filter-panel';
import ExerciseSearchRow from './ExerciseSearchRow';

interface ExerciseSearchSheetProps {
  visible: boolean;
  onDismiss: () => void;
  selected: Exercise[];
  /** Called on every toggle — the selection takes effect immediately, Done only closes. */
  onChange: (exercises: Exercise[]) => void;
}

export type SearchSheetRow = {type: 'header'; key: string; title: string} | {type: 'recent' | 'exercise'; key: string; exercise: Exercise; detail?: string};

/** The flat list behind the sheet: "Recent" (only without a search term) and "All exercises A–Z". */
export const buildSearchSheetRows = (recent: Exercise[], filtered: Exercise[], lastTrained: (exercise: Exercise) => string | undefined, query: string): SearchSheetRow[] => {
  const rows: SearchSheetRow[] = [];
  if (query.trim().length === 0 && recent.length > 0) {
    rows.push({type: 'header', key: 'header-recent', title: 'Recent'});
    recent.forEach((exercise) => rows.push({type: 'recent', key: `recent-${exercise.id}`, exercise, detail: lastTrained(exercise)}));
  }
  rows.push({type: 'header', key: 'header-all', title: query.trim().length === 0 ? 'All exercises A–Z' : `${filtered.length} matching`});
  filtered.forEach((exercise) => rows.push({type: 'exercise', key: `exercise-${exercise.id}`, exercise}));
  return rows;
};

/**
 * GH-642: near full-height bottom sheet for picking exercises — search, Recent
 * with "2 days ago", All A–Z with checkboxes, the selection as removable chips
 * and a "Done · N selected" button.
 */
const ExerciseSearchSheet = ({visible, onDismiss, selected, onChange}: ExerciseSearchSheetProps) => {
  const theme = useTheme();
  const allExercises = useAlleExercises();
  const stats = useExerciseTrainingStats();
  const [query, setQuery] = useState('');
  // Edge-to-edge Android does not shrink the window for the keyboard (see KeyboardAwareScrollView),
  // so the sheet lifts its content itself — otherwise the keyboard covers "Done" while searching.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((it) => it.id)), [selected]);
  const rows = useMemo(() => {
    const now = new Date();
    const lastTrained = (exercise: Exercise) => (exercise.id !== undefined && stats[exercise.id]?.last ? formatAgo(new Date(stats[exercise.id].last), now) : undefined);
    return buildSearchSheetRows(recentExercises(allExercises, stats), filterExercisesByName(allExercises, query), lastTrained, query);
  }, [allExercises, stats, query]);

  const toggle = useCallback((exercise: Exercise) => onChange(toggleExercise(selected, exercise)), [onChange, selected]);

  const renderRow = useCallback(
    ({item}: {item: SearchSheetRow}) =>
      item.type === 'header' ? (
        <Text variant="labelLarge" style={[styles.header, {color: theme.colors.primary}]} testID={`exercise-search-${item.key}`}>
          {item.title}
        </Text>
      ) : (
        <ExerciseSearchRow exercise={item.exercise} detail={item.detail} checked={selectedIds.has(item.exercise.id)} onToggle={toggle} testID={`exercise-search-${item.type === 'recent' ? 'recent' : 'row'}-${item.exercise.id}`} />
      ),
    [selectedIds, toggle, theme],
  );

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} style={styles.wrapper} contentContainerStyle={[styles.sheet, {backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.roundness * 5, borderTopRightRadius: theme.roundness * 5}]}>
        <View style={[styles.content, {paddingBottom: styles.content.paddingBottom + keyboardHeight}]} testID="exercise-search-sheet">
          <View style={[styles.handle, {backgroundColor: theme.colors.outlineVariant}]} />
          <Searchbar testID="exercise-search-bar" placeholder="Search exercises" value={query} onChangeText={setQuery} style={styles.search} />
          {selected.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selected} keyboardShouldPersistTaps="handled" style={styles.selectedScroll}>
              {selected.map((exercise) => (
                <Chip key={exercise.id} testID={`exercise-search-selected-${exercise.id}`} compact onClose={() => toggle(exercise)} closeIconAccessibilityLabel={`Remove ${exercise.name}`} onPress={() => toggle(exercise)}>
                  {exercise.name}
                </Chip>
              ))}
            </ScrollView>
          )}
          <View style={styles.list}>
            <FlashList data={rows} renderItem={renderRow} keyExtractor={(item) => item.key} getItemType={(item) => item.type} keyboardShouldPersistTaps="handled" extraData={selectedIds} />
          </View>
          <Button testID="exercise-search-done" mode="contained" onPress={onDismiss} style={styles.done}>
            {`Done · ${selected.length} selected`}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

export default ExerciseSearchSheet;

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '92%',
    marginBottom: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    marginVertical: 8,
  },
  search: {
    marginBottom: 8,
  },
  selectedScroll: {
    flexGrow: 0,
  },
  selected: {
    gap: 6,
    paddingBottom: 8,
  },
  list: {
    flex: 1,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  done: {
    marginTop: 8,
  },
});
