import React from 'react';
import {View} from 'react-native';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {TrainingsPlan} from '../../../models/TrainingsPlan';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';

interface PlanningOverviewProps {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

const PlanningOverview = ({trainingsPlan, micro}: PlanningOverviewProps) => {
  let trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
  let map = trainings.flatMap((training) => (training?.plannedWorkouts ? Object.values(training.plannedWorkouts) : []));
  let workouts = useWorkoutsByIds(map);

  return (
    <View>
      <MetricsOverviewForWorkouts trainingsWorkouts={workouts} showExercises={false} />
    </View>
  );
};

export default PlanningOverview;
