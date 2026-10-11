import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Checkbox, Chip, Searchbar, Text, useTheme} from 'react-native-paper';
import {useAlleExercises} from '../../../redux/Exercises/use/useAllExercises';
import {Exercise} from '../../../models/entities/Exercise';

interface Props {
  exerciseId?: number;
  alternativeIds: number[];
  onChange: (alternativeIds: number[]) => void;
  /** Called with the search field's y offset inside this component when it gains focus. */
  onSearchFocus?: (searchY: number) => void;
  onSearchBlur?: () => void;
}

const byName = (a: Exercise, b: Exercise) =>
  (a.name ?? '').trim().localeCompare((b.name ?? '').trim(), undefined, {sensitivity: 'base'});

const ExerciseAlternativesField = ({exerciseId, alternativeIds, onChange, onSearchFocus, onSearchBlur}: Props) => {
  const theme = useTheme();
  const allExercises = useAlleExercises();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [searchY, setSearchY] = useState(0);

  const availableExercises = useMemo(
    () => allExercises.filter((exercise) => exercise.id !== undefined && exercise.id !== exerciseId).sort(byName),
    [allExercises, exerciseId],
  );

  const filteredExercises = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return availableExercises;
    return availableExercises.filter((exercise) => (exercise.name ?? '').toLowerCase().includes(needle));
  }, [availableExercises, query]);

  const selectedExercises = useMemo(
    () => allExercises.filter((exercise) => exercise.id !== undefined && exercise.id !== exerciseId && alternativeIds.includes(exercise.id)),
    [alternativeIds, allExercises, exerciseId],
  );

  const toggleExercise = (id: number) => {
    if (alternativeIds.includes(id)) {
      onChange(alternativeIds.filter((altId) => altId !== id));
    } else {
      onChange([...alternativeIds, id]);
    }
  };

  const toggleVisible = () => {
    if (visible) setQuery('');
    setVisible(!visible);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Alternative Exercises</Text>
        <Button mode="outlined" compact testID="exercise-alternatives-open-button" onPress={toggleVisible}>
          {visible ? 'Done' : '+'}
        </Button>
      </View>
      <View style={styles.chips}>
        {selectedExercises.length > 0 ? (
          selectedExercises.map((exercise) => (
            <Chip
              key={exercise.id}
              mode="outlined"
              onClose={() => onChange(alternativeIds.filter((alternativeId) => alternativeId !== exercise.id))}
              style={styles.chip}
              testID={`exercise-alternative-chip-${exercise.id}`}
            >
              {exercise.name}
            </Chip>
          ))
        ) : (
          <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>No alternatives selected</Text>
        )}
      </View>
      {visible && (
        <>
          <View onLayout={(e) => setSearchY(e.nativeEvent.layout.y)}>
            <Searchbar
              placeholder="Search exercises"
              value={query}
              onChangeText={setQuery}
              onFocus={() => onSearchFocus?.(searchY)}
              onBlur={onSearchBlur}
              testID="exercise-alternatives-search"
            />
          </View>
          <ScrollView
            style={styles.listContainer}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            testID="exercise-alternatives-list"
          >
            {filteredExercises.length > 0 ? (
              filteredExercises.map((exercise) => (
                <Checkbox.Item
                  key={exercise.id}
                  label={exercise.name}
                  status={alternativeIds.includes(exercise.id!) ? 'checked' : 'unchecked'}
                  onPress={() => toggleExercise(exercise.id!)}
                  style={styles.checkboxItem}
                  labelStyle={styles.checkboxLabel}
                  testID={`exercise-alternative-row-${exercise.id}`}
                />
              ))
            ) : (
              <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]} testID="exercise-alternatives-no-match">
                No exercises match "{query.trim()}"
              </Text>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    gap: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 4,
  },
  emptyText: {
    fontStyle: 'italic',
  },
  // GH-487: was 200 (≈4–5 rows); 440 shows ≥10 rows at once.
  listContainer: {
    maxHeight: 440,
  },
  checkboxItem: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  checkboxLabel: {
    fontSize: 14,
  },
});

export default ExerciseAlternativesField;
