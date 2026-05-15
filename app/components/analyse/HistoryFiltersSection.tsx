import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Chip, Icon, Text, TouchableRipple, useTheme} from 'react-native-paper';
import {Exercise} from '../../models/entities/Exercise';
import {Muscles} from '../../models/Muscles';

const MUSCLE_OPTIONS = Object.values(Muscles);

interface Props {
  expanded: boolean;
  summary: string;
  selectedMuscles: Muscles[];
  selectedExerciseIds: number[];
  exercises: Exercise[];
  onToggleExpanded: () => void;
  onToggleMuscle: (muscle: Muscles) => void;
  onToggleExercise: (exerciseId: number) => void;
}

const HistoryFiltersSection = ({
  expanded,
  summary,
  selectedMuscles,
  selectedExerciseIds,
  exercises,
  onToggleExpanded,
  onToggleMuscle,
  onToggleExercise,
}: Props) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.elevation.level2}]} testID="history-filters-section">
      <TouchableRipple onPress={onToggleExpanded} borderless={false} testID="history-filters-toggle">
        <View style={styles.header}>
          <Icon source="tune-variant" size={18} color={theme.colors.onSurfaceVariant} />
          <View style={styles.headerText}>
            <Text variant="labelMedium" style={styles.headerLabel}>
              Filters
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={[styles.summary, {color: theme.colors.onSurfaceVariant}]} testID="history-filters-summary">
              {summary}
            </Text>
          </View>
          <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
      {expanded && (
        <View style={styles.body}>
          <Text variant="labelSmall" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
            MUSCLE
          </Text>
          <View style={styles.chipsRow}>
            {MUSCLE_OPTIONS.map((muscle) => (
              <Chip
                key={muscle}
                compact
                selected={selectedMuscles.includes(muscle)}
                onPress={() => onToggleMuscle(muscle)}
                style={styles.chip}
                testID={`history-muscle-chip-${muscle}`}>
                {muscle}
              </Chip>
            ))}
          </View>

          <Text variant="labelSmall" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
            EXERCISE
          </Text>
          <View style={styles.chipsRow}>
            {exercises.map((exercise) => (
              <Chip
                key={exercise.id ?? exercise.name}
                compact
                selected={exercise.id !== undefined && selectedExerciseIds.includes(exercise.id)}
                onPress={() => exercise.id !== undefined && onToggleExercise(exercise.id)}
                style={styles.chip}
                testID={`history-exercise-chip-${exercise.id ?? exercise.name}`}>
                {exercise.name}
              </Chip>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerLabel: {
    fontWeight: '700',
  },
  summary: {
    marginTop: 1,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sectionLabel: {
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 8,
  },
});

export default memo(HistoryFiltersSection);
