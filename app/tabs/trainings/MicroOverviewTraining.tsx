import React, {useMemo, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {SegmentedButtons, Text} from 'react-native-paper';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {TrainingsState} from '../../models/TrainingsState';
import {useAllTrainingsInMicro} from '../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../redux/Workout/use/useWorkoutsByIds';
import MicroOverview from '../../components/Training/analyse/MicroOverview';
import MicroExerciseOverview from '../../components/Training/analyse/MicroExerciseOverview';
import MetricsOverviewForWorkouts from '../../components/analyse/MetricsOverviewForWorkouts';
import {Training} from '../../models/entities/Training';

type ViewMode = 'gesamt' | 'exercise' | 'muscle';

interface Props {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

interface TrainingMuscleCardProps {
  training: Training;
  trainingName: string;
}

const TrainingMuscleCard = ({training, trainingName}: TrainingMuscleCardProps) => {
  const workoutIds = useMemo(() => Object.values(training.doneWorkoutIds), [training.doneWorkoutIds]);
  const workouts = useWorkoutsByIds(workoutIds);

  return (
    <View>
      <Text variant="titleMedium" style={{marginHorizontal: 8, marginTop: 12, marginBottom: 4}}>
        {trainingName}
      </Text>
      <MetricsOverviewForWorkouts trainingsWorkouts={workouts} showExercises={false} />
    </View>
  );
};

const MuscleView = ({trainingsPlan, micro}: Props) => {
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
        <TrainingMuscleCard
          key={training.id}
          training={training}
          trainingName={trainingNameMap.get(training.id!!) ?? 'Training'}
        />
      ))}
    </ScrollView>
  );
};

const MicroOverviewTraining = ({trainingsPlan, micro}: Props) => {
  const [view, setView] = useState<ViewMode>('gesamt');

  return (
    <View style={{flex: 1}}>
      <SegmentedButtons
        value={view}
        onValueChange={(v) => setView(v as ViewMode)}
        style={{margin: 8}}
        buttons={[
          {value: 'gesamt', label: 'Gesamt'},
          {value: 'exercise', label: 'Exercise'},
          {value: 'muscle', label: 'Muscle'},
        ]}
      />
      {view === 'gesamt' && <MicroOverview trainingsPlan={trainingsPlan} micro={micro} />}
      {view === 'exercise' && <MicroExerciseOverview trainingsPlan={trainingsPlan} micro={micro} />}
      {view === 'muscle' && <MuscleView trainingsPlan={trainingsPlan} micro={micro} />}
    </View>
  );
};

export default MicroOverviewTraining;
