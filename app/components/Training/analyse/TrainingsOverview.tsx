import {ScrollView, View} from 'react-native';
import {Card, Text} from 'react-native-paper';
import React from 'react';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import {calculateMetricComparisons} from '../../../utils/AnalyseUtils';
import MetricView from '../../analyse/MetricComparison';
import {Training} from '../../../models/entities/Training';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from "../../../models/Metric";

interface TrainingsOverviewProps {
  training: Training;
  previousTraining?: Training;
}

const TrainingsOverview = ({training, previousTraining}: TrainingsOverviewProps) => {
  let trainingsWorkouts = useWorkoutsByIds(Object.values(training.doneWorkoutIds));
  let previousWorkouts = useWorkoutsByIds(previousTraining ? Object.values(previousTraining.doneWorkoutIds) : []);

  const trainingDate = new Date(new Date(training.end!!).getTime() - new Date(training.start!!).getTime());
  const previousTrainingTime = previousTraining?.end ? new Date(new Date(previousTraining.end!!).getTime() - new Date(previousTraining.start!!).getTime()) : undefined;
  let formattedDifference;
  if (previousTrainingTime) {
    let difference = trainingDate.getTime() - previousTrainingTime.getTime();
    let isNegative = difference < 0;
    let absoluteDifference = Math.abs(difference);
    formattedDifference = (isNegative ? '-' : '+') + new Date(absoluteDifference).toISOString().substring(11, 19);
  }
  let workoutSets = trainingsWorkouts.flatMap((workout: Workout) => workout.sets);
  let prviousWorkoutSets = previousWorkouts.flatMap((workout: Workout) => workout.sets);
  let metricToComparison = calculateMetricComparisons({
    currentWorkoutSets: workoutSets,
    lastWorkoutSets: prviousWorkoutSets,
  });
  return (
    <ScrollView testID="trainings-overview" accessible accessibilityLabel="trainings-overview">
      <View testID="trainings-overview-root" accessible accessibilityLabel="trainings-overview-root">
        <View style={{display: 'flex', flexDirection: 'row', flex: 1}}>
          <View style={{flex: 1}} testID="trainings-overview-duration-card" accessible accessibilityLabel="trainings-overview-duration-card">
            <Card style={{margin: 5, flex: 1}}>
              <Card.Title title={<Text>Duration</Text>}></Card.Title>
              <Card.Content>
                {formattedDifference && <Text>{formattedDifference}</Text>}
                <Text testID="trainings-overview-duration-value" accessible accessibilityLabel={`duration-${trainingDate.toISOString().substring(11, 19)}`}>
                  {trainingDate.toISOString().substring(11, 19)}
                </Text>
              </Card.Content>
            </Card>
          </View>
          <View style={{flex: 1}} testID="trainings-overview-volume-card" accessible accessibilityLabel="trainings-overview-volume-card">
            <Card style={{margin: 5, flex: 1}}>
              <Card.Title title={<Text>Volume</Text>} />
              <Card.Content>
                <Text testID="trainings-overview-volume-value" accessible accessibilityLabel="trainings-overview-volume-value">
                  <MetricView comparison={metricToComparison.get(Metric.VOLUME)!!} />
                </Text>
              </Card.Content>
            </Card>
          </View>
          <View style={{flex: 1}} testID="trainings-overview-sets-card" accessible accessibilityLabel="trainings-overview-sets-card">
            <Card style={{margin: 5, flex: 1}}>
              <Card.Title title={<Text>Sets</Text>} />
              <Card.Content>
                <Text testID="trainings-overview-sets-value" accessible accessibilityLabel="trainings-overview-sets-value">
                  <MetricView comparison={metricToComparison.get(Metric.SETS)!!} />
                </Text>
              </Card.Content>
            </Card>
          </View>
        </View>
        <MetricsOverviewForWorkouts trainingsWorkouts={trainingsWorkouts} previousWorkouts={previousWorkouts} />
      </View>
    </ScrollView>
  );
};

export default TrainingsOverview;
