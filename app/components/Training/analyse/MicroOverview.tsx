import React from 'react';
import {ScrollView, View} from 'react-native';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {Card, Text} from 'react-native-paper';
import MetricView from '../../analyse/MetricComparison';
import {Metric} from '../../picker/elements/TrainingElementPicker';
import {calculateMetricComparisons} from '../../../utils/AnalyseUtils';
import {sum} from 'lodash';
import {TrainingsPlan} from '../../../models/TrainingsPlan';
import {Workout} from '../../../models/Workout';

interface TrainingsBaseProps {
  trainingsPlan: TrainingsPlan;
  micro: number;
}

const MicroOverview = ({trainingsPlan, micro}: TrainingsBaseProps) => {
  let trainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro);
  let previousTrainings = useAllTrainingsInMicro(trainingsPlan.id!!, micro - 1);
  let totalTimeTraining = new Date(sum(trainings.map((training) => (training.end && training.start ? new Date(training.end!!).getTime() - new Date(training.start!!).getTime() : 0))));
  let totalTimePreviousTraining =
    previousTrainings?.length > 0
      ? new Date(sum(previousTrainings.map((training) => (training.end && training.start ? new Date(training.end!!).getTime() - new Date(training.start!!).getTime() : 0))))
      : undefined;

  let formattedDifference;
  if (totalTimePreviousTraining) {
    let difference = totalTimeTraining.getTime() - totalTimePreviousTraining.getTime();
    let isNegative = difference < 0;
    let absoluteDifference = Math.abs(difference);
    formattedDifference = (isNegative ? '-' : '+') + new Date(absoluteDifference).toISOString().substring(11, 19);
  }
  let trainingsWorkouts = useWorkoutsByIds(trainings.flatMap((training) => Object.values(training.doneWorkoutIds)));
  let previousWorkouts = useWorkoutsByIds(previousTrainings.length > 0 ? previousTrainings.flatMap((training) => Object.values(training.doneWorkoutIds)) : []);
  let metricToComparison = calculateMetricComparisons({
    currentWorkoutSets: trainingsWorkouts.flatMap((workout: Workout) => {
      return workout.sets;
    }),
    lastWorkoutSets: previousWorkouts.flatMap((workout: Workout) => workout.sets),
  });

  return (
    <ScrollView>
      <View style={{display: 'flex', flexDirection: 'row', flex: 1}}>
        <Card style={{margin: 5, flex: 1}}>
          <Card.Title title={<Text>Duration</Text>}></Card.Title>
          <Card.Content>
            {formattedDifference && <Text>{formattedDifference}</Text>}
            <Text>{totalTimeTraining.toISOString().substring(11, 19)}</Text>
          </Card.Content>
        </Card>
        <Card style={{margin: 5, flex: 1}}>
          <Card.Title title={<Text>Volume</Text>} />
          <Card.Content>
            <Text>
              <MetricView comparison={metricToComparison.get(Metric.VOLUME)!!} />
            </Text>
          </Card.Content>
        </Card>
        <Card style={{margin: 5, flex: 1}}>
          <Card.Title title={<Text>Sets</Text>} />
          <Card.Content>
            <Text>
              <MetricView comparison={metricToComparison.get(Metric.SETS)!!} />
            </Text>
          </Card.Content>
        </Card>
      </View>
      <MetricsOverviewForWorkouts trainingsWorkouts={trainingsWorkouts} previousWorkouts={previousWorkouts} />
    </ScrollView>
  );
};

export default MicroOverview;
