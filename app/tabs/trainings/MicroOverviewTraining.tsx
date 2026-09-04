import React, {useMemo} from 'react';
import {View} from 'react-native';
import {SegmentedButtons, Text} from 'react-native-paper';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {TrainingsState} from '../../models/TrainingsState';
import {useAllTrainingsInMicro} from '../../redux/Training/use/useAllTrainingsInMicro';
import {useWorkoutsByIds} from '../../redux/Workout/use/useWorkoutsByIds';
import MicroOverview from '../../components/Training/analyse/MicroOverview';
import MicroExerciseOverview, {ExerciseSortMode} from '../../components/Training/analyse/MicroExerciseOverview';
import MicroPlanOverview from '../../components/Training/analyse/MicroPlanOverview';
import MetricsOverviewForWorkouts from '../../components/analyse/MetricsOverviewForWorkouts';
import {Training} from '../../models/entities/Training';

/** GH-436: 'plan' is the micro-wide planned overview that used to sit in a training's analysis. */
export type ViewMode = 'gesamt' | 'exercise' | 'muscle' | 'plan';

interface Props {
  trainingsPlan: TrainingsPlan;
  micro: number;
  isActive?: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortMode?: ExerciseSortMode;
  onSortModeChange?: (mode: ExerciseSortMode) => void;
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

const MuscleView = ({trainingsPlan, micro}: Pick<Props, 'trainingsPlan' | 'micro'>) => {
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

  // No inner ScrollView here: this renders inside TrainingsPlanNode's
  // NestableScrollContainer; a nested same-direction ScrollView clips the
  // content and blocks scrolling (GH-382).
  return (
    <View>
      {executedTrainings.map((training) => (
        <TrainingMuscleCard
          key={training.id}
          training={training}
          trainingName={trainingNameMap.get(training.id!!) ?? 'Training'}
        />
      ))}
    </View>
  );
};

const VIEW_MODE_BUTTONS: {value: ViewMode; label: string; testID: string}[] = [
  {value: 'gesamt', label: 'Gesamt', testID: 'overview-view-gesamt'},
  {value: 'exercise', label: 'Exercise', testID: 'overview-view-exercise'},
  {value: 'muscle', label: 'Muscle', testID: 'overview-view-muscle'},
  {value: 'plan', label: 'Plan', testID: 'overview-view-plan'},
];

const MicroOverviewTraining = ({trainingsPlan, micro, isActive = true, viewMode, onViewModeChange, sortMode, onSortModeChange}: Props) => {
  // No flex:1 on the root: inside the NestableScrollContainer's unbounded
  // content a flex:1 height collapses and clips the overview (GH-382).
  return (
    <View>
      <SegmentedButtons
        value={viewMode}
        onValueChange={(v) => onViewModeChange(v as ViewMode)}
        style={{margin: 8}}
        density="small"
        buttons={VIEW_MODE_BUTTONS}
      />
      {viewMode === 'gesamt' && <MicroOverview trainingsPlan={trainingsPlan} micro={micro} isActive={isActive} />}
      {viewMode === 'exercise' && <MicroExerciseOverview trainingsPlan={trainingsPlan} micro={micro} sortMode={sortMode} onSortModeChange={onSortModeChange} />}
      {viewMode === 'muscle' && <MuscleView trainingsPlan={trainingsPlan} micro={micro} />}
      {viewMode === 'plan' && <MicroPlanOverview trainingsPlan={trainingsPlan} micro={micro} />}
    </View>
  );
};

export default MicroOverviewTraining;
