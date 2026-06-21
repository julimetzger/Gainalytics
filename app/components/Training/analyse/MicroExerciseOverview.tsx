import React, {useMemo, useState} from 'react';
import {View, ScrollView} from 'react-native';
import {Card, DataTable, IconButton, Text} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {TrainingsState} from '../../../models/TrainingsState';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {useExerciseByIds} from '../../../redux/Exercises/use/useExerciseByIds';
import {Training} from '../../../models/entities/Training';
import {Workout} from '../../../models/entities/Workout';
import {WorkoutSet} from '../../../models/entities/WorkoutSet';
import {formatPlanNumber} from '../plan/planUtils';

export type ExerciseSortMode = 'plan' | 'date';

interface Props {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

interface TrainingExerciseCardProps {
  training: Training;
  trainingName: string;
  sortMode: ExerciseSortMode;
}

export function computeWeightRangeLabel(sets: ReadonlyArray<Pick<WorkoutSet, 'weight'>>): string {
  if (sets.length === 0) return '';
  const weights = sets.map((s) => s.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  return min === max ? formatPlanNumber(min) : `${formatPlanNumber(min)}-${formatPlanNumber(max)}`;
}

/** Returns exercise IDs in planned training order, filtered to those actually logged. */
export function sortExerciseIdsByPlan(
  trainingExercises: number[],
  doneWorkoutIds: {[exerciseId: number]: number},
): number[] {
  return trainingExercises.filter((exId) => doneWorkoutIds[exId] !== undefined);
}

/** Returns exercise IDs sorted by workout start date (ascending). */
export function sortExerciseIdsByDate(
  workouts: ReadonlyArray<Pick<Workout, 'exerciseId' | 'start'>>,
): number[] {
  return [...workouts]
    .sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return aTime - bTime;
    })
    .map((w) => w.exerciseId);
}

const COL_FLEX = {
  exercise: 12,
  sets: 3,
  reps: 4,
  weight: 5,
  rir: 3,
};

const TrainingExerciseCard = ({training, trainingName, sortMode}: TrainingExerciseCardProps) => {
  const workoutIds = useMemo(() => Object.values(training.doneWorkoutIds), [training.doneWorkoutIds]);
  const workouts = useWorkoutsByIds(workoutIds);

  const sortedExerciseIds = useMemo(() => {
    if (sortMode === 'plan') {
      return sortExerciseIdsByPlan(training.exercises, training.doneWorkoutIds);
    }
    return sortExerciseIdsByDate(workouts);
  }, [sortMode, training.exercises, training.doneWorkoutIds, workouts]);

  const exercises = useExerciseByIds(sortedExerciseIds);

  return (
    <Card style={{margin: 5}}>
      <Card.Title title={<Text variant="titleMedium">{trainingName}</Text>} />
      <Card.Content>
        <DataTable>
          <DataTable.Header>
            <DataTable.Title style={{flex: COL_FLEX.exercise}}>Exercise</DataTable.Title>
            <DataTable.Title style={{flex: COL_FLEX.sets}} numeric>Sets</DataTable.Title>
            <DataTable.Title style={{flex: COL_FLEX.reps}} numeric>Reps</DataTable.Title>
            <DataTable.Title style={{flex: COL_FLEX.rir}} numeric>RIR</DataTable.Title>
            <DataTable.Title style={{flex: COL_FLEX.weight}} numeric>Weight</DataTable.Title>
          </DataTable.Header>
          {exercises.map((exercise) => {
            if (!exercise) return null;
            const workout = workouts.find((w) => w.exerciseId === exercise.id);
            if (!workout || workout.sets.length === 0) return null;
            const reps = workout.sets.map((s) => s.reps);
            const rirs = workout.sets.map((s) => s.rir);
            const minReps = Math.min(...reps);
            const maxReps = Math.max(...reps);
            const minRir = Math.min(...rirs);
            const maxRir = Math.max(...rirs);
            const repsLabel = minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`;
            const rirLabel = minRir === maxRir ? `${minRir}` : `${minRir}-${maxRir}`;
            const weightLabel = computeWeightRangeLabel(workout.sets);
            return (
              <DataTable.Row key={exercise.id}>
                <DataTable.Cell style={{flex: COL_FLEX.exercise}}>
                  <Text>{exercise.name}</Text>
                </DataTable.Cell>
                <DataTable.Cell style={{flex: COL_FLEX.sets}} numeric>{workout.sets.length}</DataTable.Cell>
                <DataTable.Cell style={{flex: COL_FLEX.reps}} numeric>{repsLabel}</DataTable.Cell>
                <DataTable.Cell style={{flex: COL_FLEX.rir}} numeric>{rirLabel}</DataTable.Cell>
                <DataTable.Cell style={{flex: COL_FLEX.weight}} numeric>{weightLabel}</DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable>
      </Card.Content>
    </Card>
  );
};

const MicroExerciseOverview = ({trainingsPlan, micro}: Props) => {
  const [sortMode, setSortMode] = useState<ExerciseSortMode>('plan');
  const trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
  const executedTrainings = useMemo(() => trainings.filter((t) => t.state === TrainingsState.FINISHED), [trainings]);

  const trainingNameMap = useMemo(() => {
    const map = new Map<number, string>();
    Object.entries(trainingsPlan.trainings)
      .filter(([key]) => key.startsWith(micro.toString() + ','))
      .forEach(([key, trainingId]) => {
        const trainingInMicro = parseInt(key.split(',')[1], 10);
        const name = trainingsPlan.trainingNames?.[trainingInMicro] ?? `Training ${trainingInMicro}`;
        map.set(trainingId, name);
      });
    return map;
  }, [trainingsPlan, micro]);

  if (executedTrainings.length === 0) {
    return (
      <View style={{padding: 16}}>
        <Text>No executed trainings in this micro.</Text>
      </View>
    );
  }

  return (
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 4}}>
        <IconButton
          testID="exercise-sort-toggle"
          accessibilityLabel={sortMode === 'plan' ? 'Sorted by training order' : 'Sorted by date'}
          icon={sortMode === 'plan' ? 'sort-variant' : 'sort-clock-ascending-outline'}
          onPress={() => setSortMode((prev) => (prev === 'plan' ? 'date' : 'plan'))}
        />
      </View>
      <ScrollView>
        {executedTrainings.map((training) => (
          <TrainingExerciseCard
            key={training.id}
            training={training}
            trainingName={trainingNameMap.get(training.id!!) ?? `Training`}
            sortMode={sortMode}
          />
        ))}
      </ScrollView>
    </View>
  );
};

export default MicroExerciseOverview;
