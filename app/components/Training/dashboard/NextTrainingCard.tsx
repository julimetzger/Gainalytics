import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, Text, useTheme} from 'react-native-paper';
import {useSelector} from 'react-redux';
import {evaluationReps, evaluationWeight, formatPlanFieldValue} from '../../../utils/planRange';
import {TrainingsState} from '../../../models/TrainingsState';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {
  getLocalMicro,
  getMesoForMicro,
  getMicroFromTrainingInMicroIndex,
  getTrainingFromTrainingInMicroIndex,
  trainingInMicroIndex,
} from '../../../redux/Training/trainingsPlanReducer';
import {useTraining} from '../../../redux/Training/use/useTraining';
import {useExercise} from '../../../redux/Exercises/use/useExercise';
import {usePlannedWorkoutInTraining} from '../../../redux/Training/use/usePlannedWorkoutInTraining';
import {RootStackParamList} from '../../../routing/TrainingRouter';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {GlobalState} from '../../../redux/rootReducer';
import {Workout} from '../../../models/entities/Workout';

interface NextTrainingCardProps {
  plan: TrainingsPlan;
  nextMicro?: number;
  nextTrainingNum?: number;
  isComplete?: boolean;
  navigation: NativeStackNavigationProp<RootStackParamList, 'TrainingHome'>;
}

const useTopSetForExerciseInMicro = (
  plan: TrainingsPlan,
  exerciseId: number | undefined,
  trainingNum: number,
  beforeMicro: number | undefined,
): {weight: number; reps: number} | undefined =>
  useSelector((state: GlobalState) => {
    if (!exerciseId || beforeMicro === undefined || beforeMicro < 1) return undefined;
    const sameSlotKeys = Object.keys(plan.trainings).filter(k => {
      const m = getMicroFromTrainingInMicroIndex(k);
      const t = getTrainingFromTrainingInMicroIndex(k);
      return t === trainingNum && m < beforeMicro;
    });
    if (sameSlotKeys.length === 0) return undefined;
    sameSlotKeys.sort((a, b) => getMicroFromTrainingInMicroIndex(b) - getMicroFromTrainingInMicroIndex(a));

    for (const key of sameSlotKeys) {
      const trainingId = plan.trainings[key];
      const training = state.trainings.byId[trainingId];
      if (!training) continue;
      const workoutId = training.doneWorkoutIds?.[exerciseId];
      if (workoutId === undefined) continue;
      const workout: Workout | undefined = state.workouts.byId[workoutId];
      if (!workout?.sets?.length) continue;
      const top = workout.sets.reduce((acc, s) => (s.weight > acc.weight ? s : acc), workout.sets[0]);
      return {weight: top.weight, reps: top.reps};
    }
    return undefined;
  });

/** "1:07:04" once past an hour, "07:04" below it. */
export const formatElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

/**
 * GH-401 (H4): a session that is already STARTED must read as running — the app
 * knows the state, it just never showed it. Ticks once a second while mounted.
 */
const useElapsedSince = (start: Date | string | undefined, active: boolean): string | undefined => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (!active || start === undefined) return undefined;
  const startedAt = new Date(start).getTime();
  if (Number.isNaN(startedAt)) return undefined;
  return formatElapsed(now - startedAt);
};

const NextTrainingCard = ({plan, nextMicro, nextTrainingNum, isComplete, navigation}: NextTrainingCardProps) => {
  const theme = useTheme();

  const trainingId =
    nextMicro !== undefined && nextTrainingNum !== undefined
      ? plan.trainings[trainingInMicroIndex(nextMicro, nextTrainingNum)]
      : undefined;
  const training = useTraining(trainingId);

  const localMicro = nextMicro !== undefined ? getLocalMicro(plan.mesos, nextMicro) : undefined;
  const currentMeso = nextMicro !== undefined ? getMesoForMicro(plan.mesos, nextMicro) : undefined;

  const [exerciseId1, exerciseId2] = useSelector((state: GlobalState) => {
    const exs = training?.exercises ?? [];
    if (exs.length === 0) return [undefined, undefined] as const;
    const focus = exs.filter(id => state.exercises.byId[id]?.isFocus);
    const nonFocus = exs.filter(id => !state.exercises.byId[id]?.isFocus);
    const ordered = [...focus, ...nonFocus];
    return [ordered[0], ordered[1]] as const;
  });
  const exercise1 = useExercise(exerciseId1);
  const exercise2 = useExercise(exerciseId2);
  const plannedWorkout1 = usePlannedWorkoutInTraining(trainingId, exerciseId1);
  const plannedWorkout2 = usePlannedWorkoutInTraining(trainingId, exerciseId2);

  const prevTopSet1 = useTopSetForExerciseInMicro(plan, exerciseId1, nextTrainingNum ?? 0, nextMicro);
  const prevTopSet2 = useTopSetForExerciseInMicro(plan, exerciseId2, nextTrainingNum ?? 0, nextMicro);

  const isRunning = training?.state === TrainingsState.STARTED;
  const elapsed = useElapsedSince(training?.start, isRunning);

  // GH-401 (H1): this button navigates, it never starts a training. It is named
  // after where it takes you; the real start control lives in the Train tab.
  const handleStart = () => {
    if (isComplete || nextMicro === undefined || nextTrainingNum === undefined) {
      // Plan complete: route to first slot to allow restart / new meso
      const firstKey = Object.keys(plan.trainings).sort((a, b) => {
        const ma = getMicroFromTrainingInMicroIndex(a);
        const mb = getMicroFromTrainingInMicroIndex(b);
        if (ma !== mb) return ma - mb;
        return getTrainingFromTrainingInMicroIndex(a) - getTrainingFromTrainingInMicroIndex(b);
      })[0];
      const fallbackMicro = firstKey ? getMicroFromTrainingInMicroIndex(firstKey) : 1;
      navigation.navigate({
        name: 'TrainingPlan',
        params: {trainingsPlan: plan, micro: fallbackMicro},
      });
      return;
    }
    navigation.navigate({
      name: 'TrainingPlan',
      params: {trainingsPlan: plan, micro: nextMicro, training: nextTrainingNum, subTab: 'train'},
    });
  };

  if (isComplete) {
    return (
      <Card style={[styles.card, {borderLeftWidth: 4, borderLeftColor: theme.colors.primary}]} testID="next-training-card">
        <Card.Content>
          <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
            Next Training
          </Text>
          <Text variant="titleMedium" style={styles.completeTitle}>
            Plan complete
          </Text>
          <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant, marginBottom: 12}}>
            You finished every planned session. Start a new meso or revisit week 1.
          </Text>
          <Button mode="contained" onPress={handleStart} style={styles.startButton} testID="next-training-start-button">
            Start over
          </Button>
        </Card.Content>
      </Card>
    );
  }

  const trainingName = nextTrainingNum !== undefined ? plan.trainingNames?.[String(nextTrainingNum)] ?? `Day ${nextTrainingNum}` : 'Next session';
  const mesoLabel = currentMeso ? `${currentMeso.name} · ` : '';
  const exerciseCount = training?.exercises?.length ?? 0;

  const formatTarget = (workout: ReturnType<typeof usePlannedWorkoutInTraining>): string => {
    if (!workout?.sets?.length) return '';
    const set = workout.sets[0];
    // GH-63: a planned target may be a range ("100-110 × 8-12").
    return `${formatPlanFieldValue(set, 'weight')} × ${formatPlanFieldValue(set, 'reps')}`;
  };

  const renderDelta = (
    plannedWorkout: ReturnType<typeof usePlannedWorkoutInTraining>,
    prev: {weight: number; reps: number} | undefined,
    prevMicroLabel: string,
  ) => {
    if (!plannedWorkout?.sets?.length || !prev) return null;
    const planned = plannedWorkout.sets[0];
    // GH-63: a range counts with its lower bound, like every other evaluation.
    const deltaKg = evaluationWeight(planned) - prev.weight;
    const deltaReps = evaluationReps(planned) - prev.reps;
    const positive = deltaKg > 0 || (deltaKg === 0 && deltaReps > 0);
    const negative = deltaKg < 0 || (deltaKg === 0 && deltaReps < 0);
    if (deltaKg === 0 && deltaReps === 0) {
      return (
        <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
          = {prevMicroLabel}
        </Text>
      );
    }
    const color = positive ? theme.colors.primary : negative ? theme.colors.error : theme.colors.onSurfaceVariant;
    const sign = deltaKg >= 0 ? '+' : '';
    const kgPart = `${sign}${deltaKg}kg`;
    const repsPart = deltaReps !== 0 ? ` ${deltaReps > 0 ? '+' : ''}${deltaReps} reps` : '';
    return (
      <Text variant="labelSmall" style={{color, fontWeight: '600'}}>
        {kgPart}
        {repsPart} vs {prevMicroLabel}
      </Text>
    );
  };

  const prevLocalMicro = nextMicro !== undefined && localMicro !== undefined ? localMicro - 1 : 0;
  const prevMicroLabel = prevLocalMicro >= 1 ? `M${prevLocalMicro}` : 'prev';

  return (
    <Card style={[styles.card, {borderLeftWidth: 4, borderLeftColor: isRunning ? theme.colors.tertiary ?? theme.colors.primary : theme.colors.primary}]} testID="next-training-card">
      <Card.Content>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.statusRow}>
              <Text variant="labelSmall" style={{color: isRunning ? theme.colors.tertiary ?? theme.colors.primary : theme.colors.onSurfaceVariant, fontWeight: isRunning ? '700' : 'normal'}} testID="next-training-status-label">
                {isRunning ? 'Training running' : 'Next Training'}
              </Text>
              {isRunning && elapsed !== undefined && (
                <Text variant="labelSmall" style={{color: theme.colors.tertiary ?? theme.colors.primary, fontWeight: '700'}} testID="next-training-elapsed">
                  {elapsed}
                </Text>
              )}
            </View>
            {/* GH-401 (review 2): the name and the slot line identify WHICH session the
                card is about. They carry testIDs so a flow can prove the card follows the
                running session instead of the next one in plan order. */}
            <Text variant="titleMedium" testID="next-training-name">
              {trainingName}
            </Text>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}} testID="next-training-slot">
              {mesoLabel}M{localMicro} · D{nextTrainingNum} · {exerciseCount} exercises
            </Text>
          </View>
        </View>

        {(exercise1 || exercise2) && (
          <View style={styles.focusBlock}>
            {exercise1 && (
              <View style={styles.focusRow}>
                <View style={styles.focusLeft}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {exercise1.name}
                  </Text>
                  {renderDelta(plannedWorkout1, prevTopSet1, prevMicroLabel)}
                </View>
                {plannedWorkout1 && (
                  <Text variant="bodyMedium" style={{color: theme.colors.primary, fontWeight: '600'}} testID="next-training-target-1">
                    {formatTarget(plannedWorkout1)}
                  </Text>
                )}
              </View>
            )}
            {exercise2 && (
              <View style={styles.focusRow}>
                <View style={styles.focusLeft}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {exercise2.name}
                  </Text>
                  {renderDelta(plannedWorkout2, prevTopSet2, prevMicroLabel)}
                </View>
                {plannedWorkout2 && (
                  <Text variant="bodyMedium" style={{color: theme.colors.primary, fontWeight: '600'}} testID="next-training-target-2">
                    {formatTarget(plannedWorkout2)}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        <Button mode="contained" onPress={handleStart} style={styles.startButton} testID="next-training-start-button">
          {isRunning ? 'Continue Training' : 'Next Training'}
        </Button>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {marginHorizontal: 8, marginBottom: 8},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8},
  headerLeft: {flex: 1},
  statusRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8},
  focusBlock: {marginBottom: 12},
  focusRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: 12},
  focusLeft: {flex: 1},
  startButton: {marginTop: 4},
  completeTitle: {marginVertical: 4},
});

export default NextTrainingCard;
