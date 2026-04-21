import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {Workout} from '../../../models/entities/Workout';
import {Exercise} from '../../../models/entities/Exercise';

interface RecordsBadgeProps {
  currentWorkouts: Workout[];
  exercises: Exercise[];
}

interface RecordEntry {
  exerciseName: string;
  value: number;
}

const RecordsBadge = ({currentWorkouts, exercises}: RecordsBadgeProps) => {
  const theme = useTheme();
  const recordEntries: RecordEntry[] = currentWorkouts
    .filter((w) => w.records && Object.keys(w.records).length > 0)
    .flatMap((w) => {
      const exercise = exercises.find((e) => e.id === w.exerciseId);
      if (!exercise) return [];
      return Object.values(w.records ?? {}).map((value) => ({
        exerciseName: exercise.name,
        value: value,
      }));
    })
    .slice(0, 5);

  if (recordEntries.length === 0) return null;

  return (
    <Card style={[styles.card, {backgroundColor: theme.colors.secondaryContainer}]} testID="records-badge-card">
      <Card.Title
        title={`🏆 ${recordEntries.length} neue Record${recordEntries.length > 1 ? 's' : ''} diese Woche!`}
        titleStyle={[styles.title, {color: theme.colors.onSecondaryContainer}]}
      />
      <Card.Content>
        <View>
          {recordEntries.map((entry, idx) => (
            <Text key={idx} style={styles.recordText}>
              {entry.exerciseName}: {entry.value.toFixed(1)} kg
            </Text>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  recordText: {
    fontSize: 13,
    paddingVertical: 2,
  },
});

export default RecordsBadge;
