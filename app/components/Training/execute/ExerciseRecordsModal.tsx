import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Dialog, IconButton, Portal, Text, useTheme} from 'react-native-paper';
import {Exercise, Record} from '../../../models/entities/Exercise';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  exercise: Exercise;
}

const ExerciseRecordsModal = ({visible, onDismiss, exercise}: Props) => {
  const theme = useTheme();
  const liveExercise = useExercise(exercise.id) ?? exercise;
  const records = liveExercise.records?.[Record.ONE_RM] ?? [];
  const sorted = [...records].sort((a, b) => Number(b.value) - Number(a.value));
  const workoutIds = sorted.map(r => r.workoutId);
  const workouts = useWorkoutsByIds(workoutIds);
  const workoutById: {[id: number]: {start?: string}} = Object.fromEntries(workouts.map(w => [w.id, w]));

  return (
    <Portal>
      <Dialog testID="exercise-records-modal" visible={visible} onDismiss={onDismiss}>
        <Dialog.Title numberOfLines={1}>Records: {exercise.name}</Dialog.Title>
        <Dialog.Content>
          {sorted.length === 0 ? (
            <Text
              testID="exercise-records-empty"
              style={[styles.empty, {color: theme.colors.onSurfaceVariant}]}>
              No records yet for this exercise
            </Text>
          ) : (
            <ScrollView testID="exercise-records-list" style={styles.list}>
              {sorted.map((record, i) => {
                const workout = workoutById[record.workoutId];
                const dateStr = workout?.start ? new Date(workout.start).toLocaleDateString() : null;
                return (
                  <View key={`${record.workoutId}-${i}`} style={styles.row}>
                    <Text
                      variant="labelSmall"
                      style={[styles.rank, {color: theme.colors.onSurfaceVariant}]}>
                      #{i + 1}
                    </Text>
                    <View style={styles.dateBlock}>
                      {dateStr ? (
                        <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
                          {dateStr}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      testID={`exercise-record-value-${i}`}
                      variant="titleSmall"
                      style={{color: theme.colors.primary}}>
                      {`${Number(record.value).toFixed(1)} kg`}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <IconButton testID="exercise-records-close" icon="close" onPress={onDismiss} />
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  list: {maxHeight: 320},
  empty: {textAlign: 'center', paddingVertical: 16},
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8},
  rank: {width: 28},
  dateBlock: {flex: 1},
});

export default ExerciseRecordsModal;
