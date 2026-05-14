import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {Exercise, Record} from '../../../models/entities/Exercise';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {epley1RM, repetitionWeightByOneRm} from '../../../utils/AnalyseUtils';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {Workout} from '../../../models/entities/Workout';
import {lastOneRm} from './exerciseStats';

interface Props {
  exercise: Exercise;
}

interface RecordRow {
  value: number;
  date: Date | undefined;
  setIndex: number | undefined;
  reps: number | undefined;
  rir: number | undefined;
  key: string;
}

const REP_BUCKETS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20];

const formatDate = (d?: Date | string) => (d ? new Date(d).toDateString() : '—');

// The producing set is rarely tagged on disk (only forward-going code writes
// `set.record`), so when the tag is missing we fall back to the set whose
// individual 1RM is highest — that is the set that drove `workout.records[ONE_RM]`
// by definition of `repetitionMax(...sets)` in AnalyseUtils.
const findProducingSet = (workout: Workout | undefined): WorkoutSet | undefined => {
  if (!workout || !Array.isArray(workout.sets) || workout.sets.length === 0) return undefined;
  const tagged = workout.sets.find((s) => Array.isArray(s.record) && s.record.includes(Record.ONE_RM));
  if (tagged) return tagged;
  let best: WorkoutSet | undefined;
  let bestOneRm = -Infinity;
  for (const s of workout.sets) {
    const oneRm = epley1RM(s.weight, s.reps, s.rir);
    if (oneRm > bestOneRm) {
      bestOneRm = oneRm;
      best = s;
    }
  }
  return bestOneRm > 0 ? best : undefined;
};

const ExerciseStatsTab = ({exercise}: Props) => {
  const theme = useTheme();
  const live = useExercise(exercise.id) ?? exercise;

  const workoutIds: number[] = live?.records
    ? Object.values(live.records).flatMap((records) => records.map((r) => r.workoutId))
    : [];
  const workouts = useWorkoutsByIds(workoutIds);

  const oneRm = lastOneRm(live);

  const recordRows = useMemo<RecordRow[]>(() => {
    const recs = live?.records?.[Record.ONE_RM] ?? [];
    if (recs.length === 0) return [];
    const out: RecordRow[] = [];
    for (let idx = 0; idx < recs.length; idx++) {
      const r = recs[idx];
      // Persisted records may contain stringified numbers ("152.50") or null
      // from older redux-persist migrations. Coerce + finite-check before BOTH
      // sorting and rendering so the highest 1RM always lands at the top.
      if (r === undefined || r === null || r.value === null || r.value === undefined || r.value === '') continue;
      const numericValue = Number(r.value);
      if (!Number.isFinite(numericValue)) continue;
      const w = workouts.find((wk) => wk.id === r.workoutId);
      const producingSet = findProducingSet(w);
      out.push({
        value: numericValue,
        date: w?.start ? new Date(w.start) : undefined,
        setIndex: producingSet?.index,
        reps: producingSet?.reps,
        rir: producingSet?.rir,
        key: `${r.workoutId}-${idx}-${numericValue}`,
      });
    }
    out.sort((a, b) => b.value - a.value);
    return out;
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
        <Card.Title title="1RM records" subtitle="Top record first" titleStyle={styles.cardTitle} />
        <Card.Content>
          {recordRows.length === 0 ? (
            <Text style={styles.emptyText}>No records found.</Text>
          ) : (
            <View testID="one-rm-records-list">
              <View style={[styles.recordHeader, {borderBottomColor: theme.colors.outlineVariant}]}>
                <Text style={[styles.colDate, styles.headerCell, {color: theme.colors.onSurfaceVariant}]}>Date</Text>
                <Text style={[styles.colSet, styles.headerCell, {color: theme.colors.onSurfaceVariant}]}>Set</Text>
                <Text style={[styles.colReps, styles.headerCell, {color: theme.colors.onSurfaceVariant}]}>Reps</Text>
                <Text style={[styles.colRir, styles.headerCell, {color: theme.colors.onSurfaceVariant}]}>RIR</Text>
                <Text style={[styles.colValue, styles.headerCell, {color: theme.colors.onSurfaceVariant}]}>1RM</Text>
              </View>
              {recordRows.map((row, idx) => {
                const isTop = idx === 0;
                return (
                  <View
                    key={row.key}
                    style={[
                      styles.recordRow,
                      {borderBottomColor: theme.colors.outlineVariant},
                      isTop && {backgroundColor: theme.colors.primaryContainer},
                    ]}
                    testID={`one-rm-record-row-${idx}`}
                  >
                    <Text style={[styles.colDate, {color: theme.colors.onSurface}]}>{formatDate(row.date)}</Text>
                    <Text style={[styles.colSet, {color: theme.colors.onSurface}]}>
                      {row.setIndex !== undefined ? `Set ${row.setIndex}` : '—'}
                    </Text>
                    <Text style={[styles.colReps, {color: theme.colors.onSurface}]}>
                      {row.reps !== undefined ? row.reps : '—'}
                    </Text>
                    <Text style={[styles.colRir, {color: theme.colors.onSurface}]}>
                      {row.rir !== undefined ? row.rir : '—'}
                    </Text>
                    <Text style={[styles.colValue, {color: theme.colors.onSurface, fontWeight: isTop ? '700' : '500'}]}>
                      {row.value.toFixed(1)} kg
                    </Text>
                  </View>
                );
              })}
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
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
  },
  headerCell: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  colDate: {
    flex: 2.6,
    fontSize: 13,
  },
  colSet: {
    flex: 1.1,
    textAlign: 'center',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  colReps: {
    flex: 0.8,
    textAlign: 'center',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  colRir: {
    flex: 0.8,
    textAlign: 'center',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  colValue: {
    flex: 1.4,
    textAlign: 'right',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});

export default ExerciseStatsTab;
