import React, {useMemo} from 'react';
import {ScrollView, View} from 'react-native';
import {Card, DataTable, Text} from 'react-native-paper';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {TrainingsState} from '../../../models/TrainingsState';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {useExerciseByIds} from '../../../redux/Exercises/use/useExerciseByIds';
import {Training} from '../../../models/entities/Training';

interface Props {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

interface TrainingExerciseCardProps {
  training: Training;
  trainingName: string;
}

const TrainingExerciseCard = ({training, trainingName}: TrainingExerciseCardProps) => {
  const workoutIds = useMemo(() => Object.values(training.doneWorkoutIds), [training.doneWorkoutIds]);
  const workouts = useWorkoutsByIds(workoutIds);
  const exerciseIds = useMemo(() => workouts.map((w) => w.exerciseId), [workouts]);
  const exercises = useExerciseByIds(exerciseIds);

  return (
    <Card style={{margin: 5}}>
      <Card.Title title={<Text variant="titleMedium">{trainingName}</Text>} />
      <Card.Content>
        <DataTable>
          <DataTable.Header>
            <DataTable.Title style={{flex: 10}}>Exercise</DataTable.Title>
            <DataTable.Title style={{flex: 4}} numeric>Sets</DataTable.Title>
            <DataTable.Title style={{flex: 5}} numeric>Reps</DataTable.Title>
            <DataTable.Title style={{flex: 4}} numeric>RIR</DataTable.Title>
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
            return (
              <DataTable.Row key={exercise.id}>
                <DataTable.Cell style={{flex: 10}}>{exercise.name}</DataTable.Cell>
                <DataTable.Cell style={{flex: 4}} numeric>{workout.sets.length}</DataTable.Cell>
                <DataTable.Cell style={{flex: 5}} numeric>{repsLabel}</DataTable.Cell>
                <DataTable.Cell style={{flex: 4}} numeric>{rirLabel}</DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable>
      </Card.Content>
    </Card>
  );
};

const MicroExerciseOverview = ({trainingsPlan, micro}: Props) => {
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
    <ScrollView>
      {executedTrainings.map((training) => (
        <TrainingExerciseCard
          key={training.id}
          training={training}
          trainingName={trainingNameMap.get(training.id!!) ?? `Training`}
        />
      ))}
    </ScrollView>
  );
};

export default MicroExerciseOverview;
