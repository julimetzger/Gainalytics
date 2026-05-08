import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {Exercise, Record} from '../../../models/entities/Exercise';
import {repetitionWeightByOneRm} from '../../../utils/AnalyseUtils';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {Workout} from '../../../models/entities/Workout';
import {avgOneRm, bestOneRm, lastOneRm} from './exerciseStats';

interface Props {
  exercise: Exercise;
}

const REP_BUCKETS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];

const formatDate = (d?: Date | string) => (d ? new Date(d).toDateString() : 'Unknown Date');

const ExerciseStatsTab = ({exercise}: Props) => {
  const theme = useTheme();
  const live = useExercise(exercise.id) ?? exercise;

  const workoutIds: number[] = live?.records
    ? Object.values(live.records).flatMap((records) => records.map((r) => r.workoutId))
    : [];
  const workouts = useWorkoutsByIds(workoutIds);

  const oneRm = lastOneRm(live);
  const best = bestOneRm(live);
  const avg = avgOneRm(live);

  const lastWorkout = useMemo(() => {
    const recs = live?.records?.[Record.ONE_RM] ?? [];
    if (recs.length === 0) return undefined;
    const lastWorkoutId = recs[recs.length - 1]?.workoutId;
    return workouts.find((w) => w.id === lastWorkoutId);
  }, [workouts, live]);

  const bestWorkout = useMemo(() => {
    const recs = live?.records?.[Record.ONE_RM] ?? [];
    if (recs.length === 0) return undefined;
    const sorted = [...recs].sort((a, b) => b.value - a.value);
    return workouts.find((w) => w.id === sorted[0]?.workoutId);
  }, [workouts, live]);

  const sortedDistinctRecords = useMemo(() => {
    const recs = live?.records?.[Record.ONE_RM] ?? [];
    if (recs.length === 0) return [] as {value: number; workout?: Workout}[];
    const seen = new Set<string>();
    const out: {value: number; workout?: Workout}[] = [];
    for (const r of recs) {
      const w = workouts.find((wk) => wk.id === r.workoutId);
      const dateKey = w?.start ? new Date(w.start).toDateString() : `unknown-${r.workoutId}`;
      const key = `${r.value}|${dateKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({value: r.value, workout: w});
    }
    return out.sort((a, b) => b.value - a.value);
  }, [workouts, live]);

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
        <Card.Title title="1RM records" titleStyle={styles.cardTitle} />
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell} testID="stats-summary-best">
              <Text variant="labelSmall" style={[styles.summaryLabel, {color: theme.colors.onSurfaceVariant}]}>
                BEST
              </Text>
              <Text style={styles.summaryValue}>{Number.isFinite(best as number) ? `${(best as number).toFixed(1)} kg` : '—'}</Text>
              <Text variant="bodySmall" style={[styles.summaryDate, {color: theme.colors.onSurfaceVariant}]}>
                {bestWorkout?.start ? formatDate(bestWorkout.start) : '—'}
              </Text>
            </View>
            <View style={styles.summaryCell} testID="stats-summary-last">
              <Text variant="labelSmall" style={[styles.summaryLabel, {color: theme.colors.onSurfaceVariant}]}>
                LAST
              </Text>
              <Text style={styles.summaryValue}>{Number.isFinite(oneRm as number) ? `${(oneRm as number).toFixed(1)} kg` : '—'}</Text>
              <Text variant="bodySmall" style={[styles.summaryDate, {color: theme.colors.onSurfaceVariant}]}>
                {lastWorkout?.start ? formatDate(lastWorkout.start) : '—'}
              </Text>
            </View>
            <View style={styles.summaryCell} testID="stats-summary-avg">
              <Text variant="labelSmall" style={[styles.summaryLabel, {color: theme.colors.onSurfaceVariant}]}>
                AVG
              </Text>
              <Text style={styles.summaryValue}>{Number.isFinite(avg as number) ? `${(avg as number).toFixed(1)} kg` : '—'}</Text>
            </View>
          </View>

          {sortedDistinctRecords.length === 0 ? (
            <Text style={styles.emptyText}>No records found.</Text>
          ) : (
            <View testID="one-rm-records-list">
              {sortedDistinctRecords.map((entry, idx) => (
                <View key={`${entry.value}-${entry.workout?.id ?? idx}`} style={[styles.recordRow, {borderBottomColor: theme.colors.outlineVariant}]}>
                  <Text style={[styles.recordDate, {color: theme.colors.onSurfaceVariant}]}>{formatDate(entry.workout?.start)}</Text>
                  <Text style={styles.recordValue}>{Number.isFinite(entry.value) ? `${entry.value.toFixed(1)} kg` : '—'}</Text>
                </View>
              ))}
            </View>
          )}
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    gap: 8,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    letterSpacing: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  summaryDate: {
    marginTop: 2,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recordDate: {
    fontSize: 13,
  },
  recordValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});

export default ExerciseStatsTab;
