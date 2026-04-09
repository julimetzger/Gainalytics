import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {Training} from '../../../models/entities/Training';
import {getCompletedTrainingDurationMinutes} from '../../../utils/training-length-analysis';
import {sumBy} from 'lodash';
import {Workout} from '../../../models/entities/Workout';

interface WeeklySummaryCardProps {
  currentTrainings: Training[];
  previousTrainings: Training[];
  currentWorkouts: Workout[];
  previousWorkouts: Workout[];
}

interface DeltaViewProps {
  delta: number | undefined;
  suffix?: string;
}

const DeltaView = ({delta, suffix = ''}: DeltaViewProps) => {
  const theme = useTheme();
  if (delta === undefined) return null;
  const positive = delta >= 0;
  const color = delta === 0 ? theme.colors.onSurface : positive ? '#558b2f' : theme.colors.error;
  return (
    <Text style={[styles.deltaText, {color}]}>
      {(positive ? '+' : '') + delta.toFixed(0)}
      {suffix}
    </Text>
  );
};

const WeeklySummaryCard = ({currentTrainings, previousTrainings, currentWorkouts, previousWorkouts}: WeeklySummaryCardProps) => {
  const currentCount = currentTrainings.length;
  const prevCount = previousTrainings.length;
  const trainingDelta = prevCount > 0 ? currentCount - prevCount : undefined;

  const currentVolume = sumBy(currentWorkouts, (w) => sumBy(w.sets, (s) => s.weight * s.reps));
  const previousVolume = sumBy(previousWorkouts, (w) => sumBy(w.sets, (s) => s.weight * s.reps));
  const volumeDelta = previousVolume > 0 ? currentVolume - previousVolume : undefined;

  const currentMinutes = currentTrainings.reduce((acc, t) => acc + (getCompletedTrainingDurationMinutes(t) ?? 0), 0);
  const previousMinutes = previousTrainings.reduce((acc, t) => acc + (getCompletedTrainingDurationMinutes(t) ?? 0), 0);
  const timeDelta = previousMinutes > 0 ? currentMinutes - previousMinutes : undefined;

  const hours = Math.floor(currentMinutes / 60);
  const mins = currentMinutes % 60;
  const timeString = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;

  return (
    <Card style={styles.card} testID="weekly-summary-card">
      <Card.Title title="Deine Woche auf einen Blick" />
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{currentCount}</Text>
            <Text style={styles.kpiLabel}>Trainings</Text>
            <DeltaView delta={trainingDelta} />
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{(currentVolume / 1000).toFixed(1)}t</Text>
            <Text style={styles.kpiLabel}>Volumen</Text>
            <DeltaView delta={volumeDelta ? volumeDelta / 1000 : undefined} suffix="t" />
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{timeString}</Text>
            <Text style={styles.kpiLabel}>Zeit</Text>
            <DeltaView delta={timeDelta} suffix="min" />
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  kpi: {
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  kpiLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  deltaText: {
    fontSize: 13,
    marginTop: 2,
  },
});

export default WeeklySummaryCard;
