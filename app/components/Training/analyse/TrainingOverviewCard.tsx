import * as React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {sum} from 'lodash';
import {Workout} from '../../../models/entities/Workout';
import {Record} from '../../../models/entities/Exercise';
import {Metric} from '../../../models/Metric';
import TrainingOverviewStatItem from './TrainingOverviewStatItem';

export const countRecordExercisesInMicro = (workouts: Workout[]) => {
  const recordExerciseIds = new Set<number>();
  workouts.forEach((workout) => {
    if (workout.records?.[Record.ONE_RM] !== undefined) {
      recordExerciseIds.add(workout.exerciseId);
    }
  });
  return recordExerciseIds.size;
};

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

interface TrainingOverviewCardProps {
  trainingsPlan: TrainingsPlan;
  currentMicro?: number;
}

interface TrainingOverviewCardContentProps {
  trainingsPlan: TrainingsPlan;
  currentMicro: number;
}

const TrainingOverviewCardContent = ({trainingsPlan, currentMicro}: TrainingOverviewCardContentProps) => {
  const theme = useTheme();
  const trainings = useAllTrainingsInMicro(trainingsPlan.id!!, currentMicro);
  const previousTrainings = useAllTrainingsInMicro(trainingsPlan.id!!, currentMicro - 1);
  const previousCompletedTrainings = previousTrainings.filter((training) => training.end);

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
  const previousCompletedWorkouts = useWorkoutsByIds(previousCompletedTrainings.length > 0 ? previousCompletedTrainings.flatMap((training) => Object.values(training.doneWorkoutIds)) : []);

  const currentSets = trainingsWorkouts.flatMap((workout: Workout) => workout.sets);
  const previousSets = previousWorkouts.flatMap((workout: Workout) => workout.sets);

  const currentRecordExercises = countRecordExercisesInMicro(trainingsWorkouts);
  const previousRecordExercises = countRecordExercisesInMicro(previousCompletedWorkouts);

  // Use existing metric calculation methods
  const totalSets = calculateMetricValue(currentSets, Metric.SETS);
  const totalVolume = Math.round(calculateMetricValue(currentSets, Metric.VOLUME));
  const totalReps = calculateMetricValue(currentSets, Metric.REPS);

  const previousTotalSets = previousSets.length > 0 ? calculateMetricValue(previousSets, Metric.SETS) : 0;
  const previousTotalVolume = previousSets.length > 0 ? Math.round(calculateMetricValue(previousSets, Metric.VOLUME)) : 0;

  return (
    <View testID={`training-overview-card-${trainingsPlan.id ?? 'unknown'}-${currentMicro}`}>
      <View>
        <Text style={[styles.Title, {color: theme.colors.primary}]}>Micro {currentMicro}</Text>

        <View style={styles.statsRow}>
          <TrainingOverviewStatItem
            label="Sets"
            value={String(totalSets)}
            labelColor={theme.colors.onSurfaceVariant}
            comparison={previousTotalSets > 0 ? {current: totalSets, previous: previousTotalSets} : undefined}
          />

          <TrainingOverviewStatItem
            label="Time"
            value={formatTime(totalTimeMinutes)}
            labelColor={theme.colors.onSurfaceVariant}
            comparison={totalTimePreviousMinutes > 0 ? {current: totalTimeMinutes, previous: totalTimePreviousMinutes, unit: ' min'} : undefined}
          />

          <TrainingOverviewStatItem
            label="Volume"
            value={`${totalVolume} kg`}
            labelColor={theme.colors.onSurfaceVariant}
            comparison={previousTotalVolume > 0 ? {current: totalVolume, previous: previousTotalVolume, unit: ' kg'} : undefined}
          />

          <TrainingOverviewStatItem
            label="Records"
            value={String(currentRecordExercises)}
            labelColor={theme.colors.onSurfaceVariant}
            testID="training-overview-records-stat"
            valueTestID="training-overview-records-value"
            comparison={
              previousRecordExercises > 0
                ? {
                    current: currentRecordExercises,
                    previous: previousRecordExercises,
                    testID: 'training-overview-records-comparison',
                  }
                : undefined
            }
          />

          <TrainingOverviewStatItem label="Done" value={`${completedTrainings}/${totalPlannedTrainings}`} labelColor={theme.colors.onSurfaceVariant} />
        </View>

        <View style={styles.progressContainer}>
          <Text style={[styles.progressText, {color: theme.colors.onSurfaceVariant}]}>
            {trainings.length} trainings • {totalReps} reps • {currentRecordExercises} records
          </Text>
          {lastCompletedTraining && <Text style={[styles.lastTrainingText, {color: theme.colors.onSurfaceVariant}]}>Last: {formatDate(new Date(lastCompletedTraining.end!))}</Text>}
        </View>
      </View>
    </View>
  );
};

const TrainingOverviewCard = ({trainingsPlan, currentMicro}: TrainingOverviewCardProps) => {
  if (!currentMicro) {
    return null;
  }

  return <TrainingOverviewCardContent trainingsPlan={trainingsPlan} currentMicro={currentMicro} />;
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  progressText: {
    fontSize: 11,
    textAlign: 'center',
  },
  lastTrainingText: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default TrainingOverviewCard;
