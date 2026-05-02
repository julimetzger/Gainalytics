import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Text, useTheme} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {getLocalMicro, getMesoForMicro, trainingInMicroIndex} from '../../../redux/Training/trainingsPlanReducer';
import {useTraining} from '../../../redux/Training/use/useTraining';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {usePlannedWorkoutInTraining} from '../../../redux/Training/use/usePlannedWorkoutInTraining';
import {RootStackParamList} from '../../../routing/TrainingRouter';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

interface NextTrainingCardProps {
  plan: TrainingsPlan;
  nextMicro: number;
  nextTrainingNum: number;
  navigation: NativeStackNavigationProp<RootStackParamList, 'TrainingHome'>;
}

const NextTrainingCard = ({plan, nextMicro, nextTrainingNum, navigation}: NextTrainingCardProps) => {
  const theme = useTheme();
  const trainingId = plan.trainings[trainingInMicroIndex(nextMicro, nextTrainingNum)];
  const training = useTraining(trainingId);
  const localMicro = getLocalMicro(plan.mesos, nextMicro);
  const currentMeso = getMesoForMicro(plan.mesos, nextMicro);

  const exerciseId1 = training?.exercises?.[0];
  const exerciseId2 = training?.exercises?.[1];
  const exercise1 = useExercise(exerciseId1);
  const exercise2 = useExercise(exerciseId2);
  const plannedWorkout1 = usePlannedWorkoutInTraining(trainingId, exerciseId1);
  const plannedWorkout2 = usePlannedWorkoutInTraining(trainingId, exerciseId2);

  const trainingName = plan.trainingNames?.[String(nextTrainingNum)] ?? `Day ${nextTrainingNum}`;
  const mesoLabel = currentMeso ? `${currentMeso.name} · ` : '';
  const exerciseCount = training?.exercises?.length ?? 0;
  const totalSets = training
    ? Object.values(training.plannedWorkouts ?? {}).reduce((sum, wId) => {
        return sum;
      }, 0)
    : 0;

  const formatSets = (workout: ReturnType<typeof usePlannedWorkoutInTraining>): string => {
    if (!workout?.sets?.length) return '';
    const set = workout.sets[0];
    return `${set.weight}kg × ${set.reps}`;
  };

  const handleStart = () => {
    navigation.navigate({
      name: 'TrainingPlan',
      params: {trainingsPlan: plan, micro: nextMicro, training: nextTrainingNum},
    });
  };

  return (
    <Card style={styles.card} testID="next-training-card">
      <Card.Content>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
              Next Training
            </Text>
            <Text variant="titleMedium">{trainingName}</Text>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              {mesoLabel}M{localMicro} · D{nextTrainingNum} · {exerciseCount} exercises
            </Text>
          </View>
        </View>

        {(exercise1 || exercise2) && (
          <View style={styles.focusBlock}>
            {exercise1 && (
              <View style={styles.focusRow}>
                <Text variant="bodyMedium" style={styles.focusExercise}>
                  {exercise1.name}
                </Text>
                {plannedWorkout1 && <Text variant="bodySmall" style={{color: theme.colors.primary}}>{formatSets(plannedWorkout1)}</Text>}
              </View>
            )}
            {exercise2 && (
              <View style={styles.focusRow}>
                <Text variant="bodyMedium" style={styles.focusExercise}>
                  {exercise2.name}
                </Text>
                {plannedWorkout2 && <Text variant="bodySmall" style={{color: theme.colors.primary}}>{formatSets(plannedWorkout2)}</Text>}
              </View>
            )}
          </View>
        )}

        <Button mode="contained" onPress={handleStart} style={styles.startButton} testID="next-training-start-button">
          Start Training
        </Button>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {marginHorizontal: 8, marginBottom: 8},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8},
  headerLeft: {flex: 1},
  focusBlock: {marginBottom: 12},
  focusRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4},
  focusExercise: {flex: 1},
  startButton: {marginTop: 4},
});

export default NextTrainingCard;
