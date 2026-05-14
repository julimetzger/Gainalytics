import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Record} from '../../../models/entities/Exercise';
import {GlobalState} from '../../../redux/rootReducer';
import {getAllTrainingsForMicro} from '../../../redux/Training/trainingsPlanReducer';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {Workout} from '../../../models/entities/Workout';

interface RecordRow {
  exerciseName: string;
  kind: string;
  value: number;
  setDetails?: {weight: number; reps: number; rir: number};
}

interface MicroRecordsCardProps {
  plan: TrainingsPlan;
  currentMicro: number;
}

const MAX_VISIBLE = 3;

const MicroRecordsCard = ({plan, currentMicro}: MicroRecordsCardProps) => {
  const theme = useTheme();

  const trainings = useAllTrainingsInMicro(plan.id!!, currentMicro);
  const workoutIds = trainings.flatMap(t => Object.values(t.doneWorkoutIds));
  const workouts = useWorkoutsByIds(workoutIds);

  const exerciseNames = useSelector((state: GlobalState) => state.exercises.byId);

  const records: RecordRow[] = workouts
    .filter((w: Workout) => w.records && Object.keys(w.records).length > 0)
    .flatMap((w: Workout) =>
      Object.entries(w.records!).map(([kind, value]) => {
        const recordSet =
          (w.sets ?? []).find(s => s.record?.includes(kind as Record)) ??
          [...(w.sets ?? [])].sort((a, b) => b.weight - a.weight)[0];
        return {
          exerciseName: exerciseNames[w.exerciseId]?.name ?? `Exercise ${w.exerciseId}`,
          kind: kind === Record.ONE_RM ? '1RM' : kind,
          value,
          setDetails: recordSet ? {weight: recordSet.weight, reps: recordSet.reps, rir: recordSet.rir} : undefined,
        };
      }),
    );

  if (records.length === 0) return null;

  const visible = records.slice(0, MAX_VISIBLE);
  const remaining = records.length - MAX_VISIBLE;

  return (
    <Card style={styles.card} testID="micro-records-card">
      <Card.Content>
        <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant, marginBottom: 8}}>
          Records this micro
        </Text>
        {visible.map((r, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.nameBlock}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {r.exerciseName}
              </Text>
              {r.setDetails && (
                <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
                  {r.setDetails.weight} kg × {r.setDetails.reps} @ RIR {r.setDetails.rir}
                </Text>
              )}
            </View>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              {r.kind}
            </Text>
            <Text variant="titleSmall" style={{color: theme.colors.primary}}>
              {r.value} kg
            </Text>
          </View>
        ))}
        {remaining > 0 && (
          <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant, marginTop: 4}}>
            +{remaining} more
          </Text>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {marginHorizontal: 8, marginBottom: 8},
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8},
  nameBlock: {flex: 1},
});

export default MicroRecordsCard;
