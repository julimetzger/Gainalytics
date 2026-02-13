import * as React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/TrainingsPlan';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {sum} from 'lodash';
import {Workout} from '../../../models/Workout';
import {Metric} from '../../picker/elements/TrainingElementPicker';
import {Record} from '../../../models/Exercise';

export const countRecordExercisesInMicro = (workouts: Workout[]) => {
  const recordExerciseIds = new Set<number>();
  workouts.forEach((workout) => {
    if (workout.records?.[Record.ONE_RM] !== undefined) {
      recordExerciseIds.add(workout.exerciseId);
    }
  });
  return recordExerciseIds.size;
};

interface TrainingOverviewCardProps {
  trainingsPlan: TrainingsPlan;
  currentMicro?: number;
}

const TrainingOverviewCard = ({trainingsPlan, currentMicro}: TrainingOverviewCardProps) => {
  if (!currentMicro) {
    return null;
  }

  const theme = useTheme();
  const trainings = useAllTrainingsInMicro(trainingsPlan.id!!, currentMicro);
  const previousTrainings = useAllTrainingsInMicro(trainingsPlan.id!!, currentMicro - 1);

  // Find the latest training with an end date
  const lastCompletedTraining = trainings.filter((training) => training.end).sort((a, b) => new Date(b.end!).getTime() - new Date(a.end!).getTime())[0];

  // Calculate completed trainings vs total planned trainings
  const completedTrainings = trainings.filter((training) => training.end).length;
  const totalPlannedTrainings = Object.values(trainingsPlan.trainingNames).length;

  // Calculate total training time in minutes
  const totalTimeMillis = sum(trainings.map((training) => (training.end && training.start ? new Date(training.end).getTime() - new Date(training.start).getTime() : 0)));
  const totalTimeMinutes = Math.round(totalTimeMillis / (1000 * 60));

  const totalTimePreviousMillis =
    previousTrainings?.length > 0 ? sum(previousTrainings.map((training) => (training.end && training.start ? new Date(training.end).getTime() - new Date(training.start).getTime() : 0))) : 0;
  const totalTimePreviousMinutes = Math.round(totalTimePreviousMillis / (1000 * 60));

  // Get workouts and calculate metrics using existing helper functions
  const trainingsWorkouts = useWorkoutsByIds(trainings.flatMap((training) => Object.values(training.doneWorkoutIds)));
  const previousWorkouts = useWorkoutsByIds(previousTrainings.length > 0 ? previousTrainings.flatMap((training) => Object.values(training.doneWorkoutIds)) : []);

  const currentSets = trainingsWorkouts.flatMap((workout: Workout) => workout.sets);
  const previousSets = previousWorkouts.flatMap((workout: Workout) => workout.sets);

  const recordExercises = countRecordExercisesInMicro(trainingsWorkouts);

  // Use existing metric calculation methods
  const totalSets = calculateMetricValue(currentSets, Metric.SETS);
  const totalVolume = Math.round(calculateMetricValue(currentSets, Metric.VOLUME));
  const totalReps = calculateMetricValue(currentSets, Metric.REPS);

  const previousTotalSets = previousSets.length > 0 ? calculateMetricValue(previousSets, Metric.SETS) : 0;
  const previousTotalVolume = previousSets.length > 0 ? Math.round(calculateMetricValue(previousSets, Metric.VOLUME)) : 0;

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} h ${mins} min`;
    }
    return `${mins} min`;
  };

  const formatDate = (date: Date): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  const ComparisonIndicator = ({current, previous, unit = ''}: {current: number; previous: number; unit?: string}) => {
    if (previous === 0) return null;
    const diff = current - previous;
    const isPositive = diff > 0;
    return (
      <Text
        style={[
          styles.comparisonText,
          {
            color: isPositive ? theme.colors.primary : theme.colors.error,
          },
        ]}
      >
        {isPositive ? '+' : ''}
        {diff}
        {unit}
      </Text>
    );
  };

  return (
    <View>
      <View>
        <Text style={[styles.Title, {color: theme.colors.primary}]}>Micro {currentMicro}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
            {previousTotalSets > 0 && <ComparisonIndicator current={totalSets} previous={previousTotalSets} />}
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatTime(totalTimeMinutes)}</Text>
            <Text style={styles.statLabel}>Time</Text>
            {totalTimePreviousMinutes > 0 && <ComparisonIndicator current={totalTimeMinutes} previous={totalTimePreviousMinutes} unit=" min" />}
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalVolume} kg</Text>
            <Text style={styles.statLabel}>Volume</Text>
            {previousTotalVolume > 0 && <ComparisonIndicator current={totalVolume} previous={previousTotalVolume} unit=" kg" />}
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {completedTrainings}/{totalPlannedTrainings}
            </Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {trainings.length} trainings • {totalReps} reps • {recordExercises} records
          </Text>
          {lastCompletedTraining && <Text style={styles.lastTrainingText}>Last: {formatDate(new Date(lastCompletedTraining.end!))}</Text>}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  Title: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  comparisonText: {
    fontSize: 10,
    fontWeight: '500',
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  progressText: {
    fontSize: 11,
    color: '#666',
  },
  lastTrainingText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
});

export default TrainingOverviewCard;
