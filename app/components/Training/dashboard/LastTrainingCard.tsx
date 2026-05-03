import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Metric} from '../../../models/Metric';
import {getLocalMicro, getMesoForMicro, getMicroFromTrainingInMicroIndex, getTrainingFromTrainingInMicroIndex} from '../../../redux/Training/trainingsPlanReducer';
import {useTraining} from '../../../redux/Training/use/useTraining';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {sum} from 'lodash';

interface LastTrainingCardProps {
  plan: TrainingsPlan;
  lastDone: {micro: number; training: number};
}

const formatTimeAgo = (date: Date): string => {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
};

const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const LastTrainingCard = ({plan, lastDone}: LastTrainingCardProps) => {
  const theme = useTheme();
  const trainingId = plan.trainings[`${lastDone.micro},${lastDone.training}`];
  const training = useTraining(trainingId);

  const prevMicro = lastDone.micro > 1 ? lastDone.micro - 1 : undefined;
  const prevTrainings = useAllTrainingsInMicro(plan.id!!, prevMicro ?? -1);

  const workoutIds = training ? Object.values(training.doneWorkoutIds) : [];
  const workouts = useWorkoutsByIds(workoutIds);

  const prevTrainingForSameDay = prevTrainings.find((_t, i) => {
    const key = Object.entries(plan.trainings).find(([k, v]) => v === prevTrainings[i]?.id)?.[0];
    return key ? getTrainingFromTrainingInMicroIndex(key) === lastDone.training : false;
  });
  const prevWorkoutIds = prevTrainingForSameDay ? Object.values(prevTrainingForSameDay.doneWorkoutIds) : [];
  const prevWorkouts = useWorkoutsByIds(prevWorkoutIds);

  if (!training?.end) return null;

  const trainingName = plan.trainingNames?.[String(lastDone.training)] ?? `Day ${lastDone.training}`;
  const localMicro = getLocalMicro(plan.mesos, lastDone.micro);
  const currentMeso = getMesoForMicro(plan.mesos, lastDone.micro);
  const mesoLabel = currentMeso ? `${currentMeso.name} · ` : '';

  const sets: WorkoutSet[] = workouts.flatMap((w: Workout) => w.sets ?? []);
  const prevSets: WorkoutSet[] = prevWorkouts.flatMap((w: Workout) => w.sets ?? []);

  const totalSets = calculateMetricValue(sets, Metric.SETS);
  const volume = Math.round(calculateMetricValue(sets, Metric.VOLUME));
  const prevVolume = prevSets.length > 0 ? Math.round(calculateMetricValue(prevSets, Metric.VOLUME)) : 0;
  const durationMs = new Date(training.end).getTime() - new Date(training.start!).getTime();
  const durationMin = Math.round(durationMs / 60000);

  const volumeDelta = prevVolume > 0 ? volume - prevVolume : null;
  const isVolPositive = (volumeDelta ?? 0) >= 0;

  return (
    <Card style={styles.card} testID="last-training-card">
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.left}>
            <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
              Last Training
            </Text>
            <Text variant="titleSmall">{trainingName}</Text>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              {mesoLabel}M{localMicro} · D{lastDone.training} · {formatTimeAgo(new Date(training.end))}
            </Text>
          </View>
          <View style={styles.metrics}>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              {totalSets} sets · {formatTime(durationMin)}
            </Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Text variant="bodySmall">{volume.toLocaleString()} kg</Text>
              {volumeDelta !== null && (
                <Text style={[styles.delta, {color: isVolPositive ? theme.colors.primary : theme.colors.error}]}>
                  {isVolPositive ? '+' : ''}
                  {volumeDelta}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {marginHorizontal: 8, marginBottom: 8},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  left: {flex: 1},
  metrics: {alignItems: 'flex-end'},
  delta: {fontSize: 11},
});

export default LastTrainingCard;
