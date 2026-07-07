import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {repetitionWeightByOneRm} from '../../../utils/AnalyseUtils';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {lastOneRm} from './exerciseStats';
import ExerciseOneRmRecordsTable from './ExerciseOneRmRecordsTable';

interface Props {
  exercise: Exercise;
}

const REP_BUCKETS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];

const ExerciseStatsTab = ({exercise}: Props) => {
  const theme = useTheme();
  const live = useExercise(exercise.id) ?? exercise;

  const oneRm = lastOneRm(live);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" testID="exercise-stats-tab">
      <Card style={styles.card}>
        <Card.Title title="Rep estimates" subtitle="From current 1RM" titleStyle={styles.cardTitle} />
        <Card.Content>
          {oneRm !== undefined ? (
            <View style={styles.repTable} testID="rep-estimates-table">
              {REP_BUCKETS.map((reps) => (
                <View key={reps} style={[styles.repRow, {borderBottomColor: theme.colors.outlineVariant}]}>
                  <Text style={styles.repCol}>{reps} reps</Text>
                  <Text style={styles.weightCol}>{repetitionWeightByOneRm(reps, 0, oneRm).toFixed(1)} kg</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No current 1RM data available.</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="1RM records" subtitle="Top record first" titleStyle={styles.cardTitle} />
        <Card.Content>
          <ExerciseOneRmRecordsTable exercise={exercise} />
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  card: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  repTable: {
    marginTop: 4,
  },
  repRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  repCol: {
    fontSize: 14,
  },
  weightCol: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});

export default ExerciseStatsTab;
