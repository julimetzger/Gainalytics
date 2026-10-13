import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Chip, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {PlanField} from './planTypes';
import PlanReadSetRow from './PlanReadSetRow';
import {useProgressiveLimit} from '../../common/ProgressiveMount';

interface PlanReadListProps {
  exercises: Exercise[];
  selectedExerciseId?: number;
  plannedWorkoutsByExerciseId: Record<number, Workout | undefined>;
  /** GH-418: a tapped value opens the full edit mode with that field focused. */
  onCellPress: (exerciseId: number, setIndex: number, field: PlanField) => void;
  /** GH-418: a long press anywhere on a workout opens its editing. */
  onExerciseLongPress: (exerciseId: number) => void;
  onSelectExercise: (exercise: Exercise) => void;
}

const sortSets = (sets: WorkoutSet[]) => [...sets].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

const PlanReadList = ({
  exercises,
  selectedExerciseId,
  plannedWorkoutsByExerciseId,
  onCellPress,
  onExerciseLongPress,
  onSelectExercise,
}: PlanReadListProps) => {
  const theme = useTheme();
  // PERF-003: inside a ProgressiveMount the exercise sections arrive a few per commit (Infinity elsewhere).
  const sectionLimit = useProgressiveLimit(2);

  return (
    <View style={styles.list}>
      {exercises.slice(0, sectionLimit).map((exercise) => {
        if (exercise.id === undefined) {
          return null;
        }
        const sets = sortSets(plannedWorkoutsByExerciseId[exercise.id]?.sets ?? []);
        const selected = exercise.id === selectedExerciseId;
        const exerciseId = exercise.id;
        const openEditing = () => onExerciseLongPress(exerciseId);

        return (
          <View
            key={`plan-read-section-${exercise.id}`}
            testID={`plan-read-exercise-section-${exercise.id}`}
            style={[
              styles.section,
              selected && {
                backgroundColor: withAlpha(theme.colors.primary, 0.08),
                borderLeftColor: theme.colors.primary,
                borderLeftWidth: 2,
              },
            ]}
          >
            <Pressable
              testID={`plan-read-exercise-header-${exercise.id}`}
              onPress={() => onSelectExercise(exercise)}
              onLongPress={openEditing}
              style={styles.headerRow}
            >
              <Text
                style={[
                  styles.title,
                  {color: theme.colors.onSurface, fontWeight: selected ? '600' : '500'},
                ]}
                numberOfLines={1}
              >
                {exercise.name}
              </Text>
              <Chip compact style={styles.chip} testID={`plan-read-set-count-${exercise.id}`}>
                {`${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`}
              </Chip>
            </Pressable>
            {sets.length === 0 ? (
              <Text style={[styles.emptyText, {color: theme.colors.onSurfaceVariant}]}>No planned sets yet.</Text>
            ) : (
              sets.map((workoutSet) => (
                <PlanReadSetRow
                  key={`read-${exercise.id}-${workoutSet.index}`}
                  workoutSet={workoutSet}
                  onCellPress={(field) => onCellPress(exerciseId, workoutSet.index ?? 0, field)}
                  onRowLongPress={openEditing}
                />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
  },
  section: {
    borderRadius: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    borderLeftWidth: 0,
    borderLeftColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  chip: {
    minHeight: 28,
  },
  emptyText: {
    paddingHorizontal: 28,
    paddingTop: 4,
    fontSize: 13,
  },
});

export default PlanReadList;
