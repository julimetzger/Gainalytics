import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Comparison} from '../../../components/analyse/MetricsOverviewForWorkouts';
import {Metric} from '../../../models/Metric';

interface TopExercisesCardProps {
  exerciseMetricMap: Map<Exercise, Map<Metric, Comparison>>;
  onExercisePress: (exercise: Exercise) => void;
}

const TopExercisesCard = ({exerciseMetricMap, onExercisePress}: TopExercisesCardProps) => {
  const theme = useTheme();

  const topExercises = Array.from(exerciseMetricMap.entries())
    .map(([exercise, metrics]) => ({exercise, metrics}))
    .filter(({metrics}) => (metrics.get(Metric.VOLUME)?.value ?? 0) > 0)
    .sort((a, b) => (b.metrics.get(Metric.VOLUME)?.value ?? 0) - (a.metrics.get(Metric.VOLUME)?.value ?? 0))
    .slice(0, 5);

  if (topExercises.length === 0) return null;

  return (
    <Card style={styles.card} testID="top-exercises-card">
      <Card.Title title="Top Exercises This Week" />
      <Card.Content>
        {topExercises.map(({exercise, metrics}) => {
          const volume = metrics.get(Metric.VOLUME);
          const oneRm = metrics.get(Metric.ONE_RM);
          const volumeDelta = volume?.difference;
          const positive = (volumeDelta ?? 0) >= 0;
          const deltaColor = volumeDelta === undefined ? undefined : volumeDelta === 0 ? theme.colors.onSurface : positive ? theme.colors.primary : theme.colors.error;

          return (
            <TouchableOpacity key={exercise.id} onPress={() => onExercisePress(exercise)} style={styles.exerciseRow} testID={`top-exercise-${exercise.id}`}>
              <View style={styles.nameCol}>
                <Text style={styles.exerciseName} numberOfLines={1}>
                  {exercise.name}
                </Text>
              </View>
              <View style={styles.metricsCol}>
                <Text style={styles.metricValue}>{((volume?.value ?? 0) / 1000).toFixed(1)}t</Text>
                {volumeDelta !== undefined && (
                  <Text style={[styles.deltaText, {color: deltaColor}]}>
                    {(positive ? '+' : '') + (volumeDelta / 1000).toFixed(1)}t
                  </Text>
                )}
              </View>
              {oneRm && oneRm.value > 0 && (
                <View style={styles.rmCol}>
                  <Text style={styles.metricValue}>{oneRm.value.toFixed(1)} kg</Text>
                  <Text style={styles.metricLabel}>~1RM</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  nameCol: {
    flex: 2,
  },
  metricsCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rmCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
  },
  metricLabel: {
    fontSize: 11,
    opacity: 0.6,
  },
  deltaText: {
    fontSize: 12,
  },
});

export default TopExercisesCard;
