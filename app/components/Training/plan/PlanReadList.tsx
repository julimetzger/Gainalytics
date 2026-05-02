import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Chip, Text, useTheme} from 'react-native-paper';
import OutsidePressHandler from 'react-native-outside-press';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {withAlpha} from '../../../utils/colorUtils';
import {PlanField, QuickEditTarget} from './planTypes';
import PlanReadSetRow from './PlanReadSetRow';
import PlanQuickEditSetRow from './PlanQuickEditSetRow';

interface PlanReadListProps {
  exercises: Exercise[];
  selectedExerciseId?: number;
  plannedWorkoutsByExerciseId: Record<number, Workout | undefined>;
  mode: 'read' | 'quickEdit';
  quickEditTarget: QuickEditTarget | null;
  quickEditDraft: string;
  quickEditInvalid: boolean;
  onCellPress: (exerciseId: number, setIndex: number, field: PlanField) => void;
  onQuickEditChange: (value: string) => void;
  onQuickEditSubmit: () => void;
  onQuickEditOutsidePress: () => void;
  onSelectExercise: (exercise: Exercise) => void;
}

const sortSets = (sets: WorkoutSet[]) => [...sets].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

const PlanReadList = ({
  exercises,
  selectedExerciseId,
  plannedWorkoutsByExerciseId,
  mode,
  quickEditTarget,
  quickEditDraft,
  quickEditInvalid,
  onCellPress,
  onQuickEditChange,
  onQuickEditSubmit,
  onQuickEditOutsidePress,
  onSelectExercise,
}: PlanReadListProps) => {
  const theme = useTheme();

  const content = (
    <View style={styles.list}>
      {exercises.map((exercise) => {
        if (exercise.id === undefined) {
          return null;
        }
        const sets = sortSets(plannedWorkoutsByExerciseId[exercise.id]?.sets ?? []);
        const selected = exercise.id === selectedExerciseId;

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
              sets.map((workoutSet) => {
                const active =
                  quickEditTarget?.exerciseId === exercise.id && quickEditTarget?.setIndex === workoutSet.index;
                const onRowLongPress = () => {
                  // TODO: wire the plan-row action sheet here in the follow-up ticket.
                };

                if (mode === 'quickEdit' && active && quickEditTarget !== null) {
                  return (
                    <PlanQuickEditSetRow
                      key={`quick-${exercise.id}-${workoutSet.index}`}
                      workoutSet={workoutSet}
                      activeField={quickEditTarget.field}
                      draftValue={quickEditDraft}
                      invalid={quickEditInvalid}
                      onCellPress={(field) => onCellPress(exercise.id as number, workoutSet.index ?? 0, field)}
                      onChangeText={onQuickEditChange}
                      onSubmitEditing={onQuickEditSubmit}
                      onRowLongPress={onRowLongPress}
                    />
                  );
                }

                return (
                  <PlanReadSetRow
                    key={`read-${exercise.id}-${workoutSet.index}`}
                    workoutSet={workoutSet}
                    onCellPress={(field) => onCellPress(exercise.id as number, workoutSet.index ?? 0, field)}
                    onRowLongPress={onRowLongPress}
                  />
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );

  if (mode === 'quickEdit') {
    return <OutsidePressHandler onOutsidePress={onQuickEditOutsidePress}>{content}</OutsidePressHandler>;
  }

  return content;
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
