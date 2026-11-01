import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {Card, Icon, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Comparison} from '../../../components/analyse/MetricsOverviewForWorkouts';
import {Metric} from '../../../models/Metric';

interface FocusExercisesCardProps {
  exerciseMetricMap: Map<Exercise, Map<Metric, Comparison>>;
  onExercisePress: (exercise: Exercise) => void;
}

const FocusExercisesCard = ({exerciseMetricMap, onExercisePress}: FocusExercisesCardProps) => {
  const theme = useTheme();

  const focusExercises = Array.from(exerciseMetricMap.entries())
    .filter(([exercise, metrics]) => exercise.isFocus && (metrics.get(Metric.VOLUME)?.value ?? 0) > 0)
    .map(([exercise, metrics]) => ({exercise, metrics}))
    .sort((a, b) => a.exercise.name.localeCompare(b.exercise.name));

  if (focusExercises.length === 0) return null;

  return (
    <Card style={styles.card} testID="focus-exercises-card">
      <Card.Title title="Focus Exercises" />
      <Card.Content>
        {focusExercises.map(({exercise, metrics}) => {
          const volume = metrics.get(Metric.VOLUME);
          const oneRm = metrics.get(Metric.ONE_RM)?.value;

          return (
            <TouchableOpacity
              key={exercise.id}
              onPress={() => onExercisePress(exercise)}
              style={styles.exerciseRow}
              testID={`focus-exercise-${exercise.id}`}
            >
              <View style={styles.nameCol}>
                <View style={styles.nameRow}>
                  <Icon source="star" size={14} color="#FFB300" />
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {exercise.name}
                  </Text>
                </View>
              </View>
              <View style={styles.metricsCol}>
                <Text style={styles.metricValue}>{((volume?.value ?? 0) / 1000).toFixed(1)}t</Text>
              </View>
              {oneRm !== undefined && oneRm > 0 && (
                <View style={styles.rmCol}>
                  <Text style={styles.metricValue}>{oneRm.toFixed(1)} kg</Text>
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
});

export default FocusExercisesCard;
