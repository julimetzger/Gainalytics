import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Checkbox, Chip, Text, useTheme} from 'react-native-paper';
import {useAlleExercises} from '../../../redux/Exercises/use/useAllExercises';

interface Props {
  exerciseId?: number;
  alternativeIds: number[];
  onChange: (alternativeIds: number[]) => void;
}

const ExerciseAlternativesField = ({exerciseId, alternativeIds, onChange}: Props) => {
  const theme = useTheme();
  const allExercises = useAlleExercises();
  const [visible, setVisible] = useState(false);

  const availableExercises = useMemo(
    () => allExercises.filter((exercise) => exercise.id !== undefined && exercise.id !== exerciseId),
    [allExercises, exerciseId],
  );

  const selectedExercises = useMemo(
    () => availableExercises.filter((exercise) => exercise.id !== undefined && alternativeIds.includes(exercise.id)),
    [alternativeIds, availableExercises],
  );

  const toggleExercise = (id: number) => {
    if (alternativeIds.includes(id)) {
      onChange(alternativeIds.filter((altId) => altId !== id));
    } else {
      onChange([...alternativeIds, id]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Alternative Exercises</Text>
        <Button mode="outlined" compact testID="exercise-alternatives-open-button" onPress={() => setVisible(!visible)}>
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
            >
              {exercise.name}
            </Chip>
          ))
        ) : (
          <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>No alternatives selected</Text>
        )}
      </View>
      {visible && (
        <ScrollView style={styles.listContainer} nestedScrollEnabled>
          {availableExercises.map((exercise) => (
            <Checkbox.Item
              key={exercise.id}
              label={exercise.name}
              status={alternativeIds.includes(exercise.id!) ? 'checked' : 'unchecked'}
              onPress={() => toggleExercise(exercise.id!)}
              style={styles.checkboxItem}
              labelStyle={styles.checkboxLabel}
            />
          ))}
        </ScrollView>
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
  listContainer: {
    maxHeight: 200,
  },
  checkboxItem: {
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  checkboxLabel: {
    fontSize: 14,
  },
});

export default ExerciseAlternativesField;
