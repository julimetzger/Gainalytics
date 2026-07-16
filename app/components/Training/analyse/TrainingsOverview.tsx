import {ScrollView, View} from 'react-native';
import {Card, Text} from 'react-native-paper';
import React, {useEffect, useMemo, useState} from 'react';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {useLastFinishedWorkoutsByExerciseIds} from '../../../redux/Workout/use/useLastFinishedWorkoutsByExerciseIds';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import {calculateMetricComparisons} from '../../../utils/AnalyseUtils';
import MetricView from '../../analyse/MetricComparison';
import {Training} from '../../../models/entities/Training';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from "../../../models/Metric";
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import VelocityLossInsightCard from '../VelocityLossInsightCard';
import {useVelocityLossInsights} from '../useVelocityLossInsights';
import MuscleInvolvementCard from '../plan/MuscleInvolvementCard';
import {TrainingsState} from '../../../models/TrainingsState';
import CollapsibleSection from '../../analyse/CollapsibleSection';

interface TrainingsOverviewProps {
  training: Training;
  previousTraining?: Training;
  trainingsPlan: TrainingsPlan;
  currentMicro: number;
  trainingInMicro: number;
}

const TrainingsOverview = ({training, previousTraining, trainingsPlan, currentMicro, trainingInMicro}: TrainingsOverviewProps) => {
  const trainingWorkoutIds = useMemo(
    () => new Set(Object.values(training.doneWorkoutIds) as number[]),
    [training.doneWorkoutIds],
  );
  const vlInsights = useVelocityLossInsights(trainingsPlan, currentMicro, trainingWorkoutIds);
  let trainingsWorkouts = useWorkoutsByIds(Object.values(training.doneWorkoutIds));
  const currentWorkoutIds = Object.values(training.doneWorkoutIds);
  let previousWorkoutsFromTraining = useWorkoutsByIds(previousTraining ? Object.values(previousTraining.doneWorkoutIds) : []);
  let fallbackPreviousWorkouts = useLastFinishedWorkoutsByExerciseIds(training.exercises, currentWorkoutIds);
  let previousWorkouts = previousTraining !== undefined ? previousWorkoutsFromTraining : fallbackPreviousWorkouts;

  const isLive = training.state === TrainingsState.STARTED;
  // While the training is live the duration has no end timestamp yet, so tick a local
  // "now" every second to keep the displayed duration counting up between renders.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isLive) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isLive]);
  const trainingEnd = training.end ?? new Date(now);
  const trainingDate = new Date(new Date(trainingEnd).getTime() - new Date(training.start!!).getTime());
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
    // Containers must not be `accessible`: that merges the whole subtree into one
    // accessibility node, hiding every value from screen readers and UI tests.
    <ScrollView testID="trainings-overview">
      <View testID="trainings-overview-root">
        <View style={{display: 'flex', flexDirection: 'row', flex: 1}}>
          <View style={{flex: 1}} testID="trainings-overview-duration-card">
            <Card style={{margin: 5, flex: 1}}>
              <Card.Title title={<Text>{isLive ? 'Duration (live)' : 'Duration'}</Text>}></Card.Title>
              <Card.Content>
                {formattedDifference && <Text>{formattedDifference}</Text>}
                <Text testID="trainings-overview-duration-value" accessible accessibilityLabel={`duration-${trainingDate.toISOString().substring(11, 19)}`}>
                  {trainingDate.toISOString().substring(11, 19)}
                </Text>
              </Card.Content>
            </Card>
          </View>
          <View style={{flex: 1}} testID="trainings-overview-volume-card">
            <Card style={{margin: 5, flex: 1}}>
              <Card.Title title={<Text>Volume</Text>} />
              <Card.Content>
                <Text testID="trainings-overview-volume-value" accessible accessibilityLabel="trainings-overview-volume-value">
                  <MetricView comparison={metricToComparison.get(Metric.VOLUME)!!} />
                </Text>
              </Card.Content>
            </Card>
          </View>
          <View style={{flex: 1}} testID="trainings-overview-sets-card">
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
        {vlInsights.length > 0 && (
          <View style={{marginTop: 4}}>
            {vlInsights.map((insight) => (
              <VelocityLossInsightCard
                key={insight.exerciseId}
                exerciseName={insight.exerciseName}
                heaviestWeightKg={insight.heaviestWeightKg}
                currentVlPercent={insight.currentVlPercent}
                vlRirEstimate={insight.vlRirEstimate}
                reportedRir={insight.reportedRir}
                microHistory={insight.microHistory}
                currentMicro={currentMicro}
              />
            ))}
          </View>
        )}
        {trainingsPlan.id !== undefined && (
          <CollapsibleSection id="muscleMap" title="Muscle Map">
            <MuscleInvolvementCard
              trainingsPlanId={trainingsPlan.id}
              micro={currentMicro}
              trainingInMicro={trainingInMicro}
              view="analyse"
              showDismiss={false}
              isLive={isLive}
            />
          </CollapsibleSection>
        )}
        <CollapsibleSection id="metrics" title="Metriken">
          <MetricsOverviewForWorkouts trainingsWorkouts={trainingsWorkouts} previousWorkouts={previousWorkouts} />
        </CollapsibleSection>
      </View>
    </ScrollView>
  );
};

export default TrainingsOverview;
