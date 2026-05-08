import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Icon, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {bestOneRm, oneRmIncreaseDelta} from './exerciseStats';
import {useExerciseWorkoutSummary} from '../../../redux/Workout/use/useExerciseWorkoutSummary';
import {formatTimeAgo} from './formatTimeAgo';

interface Props {
  exercise: Exercise;
}

const ExerciseDetailHeaderCards = ({exercise}: Props) => {
  const theme = useTheme();
  const best = bestOneRm(exercise);
  const delta = oneRmIncreaseDelta(exercise);
  const summary = useExerciseWorkoutSummary(exercise.id);

  const oneRmText = best !== undefined ? `${best.toFixed(1)} kg` : '—';
  const lastDoneText = summary.lastWorkoutEnd ? formatTimeAgo(summary.lastWorkoutEnd) : '—';
  const totalText = summary.totalFinishedWorkouts > 0 ? String(summary.totalFinishedWorkouts) : '—';

  return (
    <View style={styles.row} testID="exercise-detail-header-cards">
      <Card mode="elevated" style={styles.card} testID="header-card-one-rm">
        <Card.Content style={styles.content}>
          <Text variant="labelSmall" style={[styles.label, {color: theme.colors.onSurfaceVariant}]}>
            1RM
          </Text>
          <Text style={[styles.value, {color: theme.colors.onSurface}]} numberOfLines={1}>
            {oneRmText}
          </Text>
          {delta !== undefined && delta !== 0 && (
            <View style={styles.deltaRow} testID="header-card-one-rm-delta">
              <Icon
                source={delta > 0 ? 'arrow-up' : 'arrow-down'}
                size={12}
                color={delta > 0 ? theme.colors.primary : theme.colors.error}
              />
              <Text
                variant="labelSmall"
                style={{color: delta > 0 ? theme.colors.primary : theme.colors.error}}
              >
                {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} testID="header-card-last-workout">
        <Card.Content style={styles.content}>
          <Text variant="labelSmall" style={[styles.label, {color: theme.colors.onSurfaceVariant}]}>
            Last workout
          </Text>
          <Text style={[styles.value, {color: theme.colors.onSurface}]} numberOfLines={1}>
            {lastDoneText}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="elevated" style={styles.card} testID="header-card-total-workouts">
        <Card.Content style={styles.content}>
          <Text variant="labelSmall" style={[styles.label, {color: theme.colors.onSurfaceVariant}]}>
            Total workouts
          </Text>
          <Text style={[styles.value, {color: theme.colors.onSurface}]} numberOfLines={1}>
            {totalText}
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  card: {
    flex: 1,
  },
  content: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 64,
    justifyContent: 'center',
  },
  label: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
});

export default ExerciseDetailHeaderCards;
