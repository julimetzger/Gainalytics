import React, {useMemo, useState} from 'react';
import {StyleSheet} from 'react-native';
import {Card, DataTable, Text} from 'react-native-paper';
import EditDialogScaffold from '../common/EditDialogScaffold';
import {calculateMetricComparisons, calculateMetricComparisonsForMuscle, calculateMetricValue, WorkoutSetMap} from '../../utils/AnalyseUtils';
import {useExerciseByIds} from '../../redux/Exercises/use/useExerciseByIds';
import MetricView from './MetricComparison';
import {Muscles} from '../../models/Muscles';
import {Exercise, MusclePercentPair} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';
import ExerciseMetricOverview from '../exercise/show/ExerciseMetricOverview';
import {Metric, MetricOverviewSection} from '../../models/Metric';
import {useMetricOverviewSlots} from '../../redux/settings/use/useMetricOverviewSlots';
import {dispatchSetMetricOverviewSlot} from '../../redux/settings/dispatch/dispatchSetMetricOverviewSlot';
import MetricSelectionDialog from './MetricSelectionDialog';

export interface Comparison {
  value: number;
  difference?: number;
}

interface WorkoutSetOverviewProps {
  trainingsWorkouts: Workout[];
  previousWorkouts?: Workout[];
  showExercises?: boolean;
}

interface MuscleDetails {
  muscle: Muscles;
  metric: Metric;
}

interface MetricSelectorState {
  section: MetricOverviewSection;
  slotIndex: number;
}

const MetricsOverviewForWorkouts = ({trainingsWorkouts, previousWorkouts = [], showExercises = true}: WorkoutSetOverviewProps) => {
  const exerciseIds = useMemo(() => [...new Set([...trainingsWorkouts, ...previousWorkouts].map((workout) => workout.exerciseId))], [previousWorkouts, trainingsWorkouts]);
  const exercises = useExerciseByIds(exerciseIds);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleDetails | undefined>(undefined);
  const [metricSelector, setMetricSelector] = useState<MetricSelectorState | undefined>(undefined);
  const muscleMetrics = useMetricOverviewSlots('muscles');
  const exerciseMetrics = useMetricOverviewSlots('exercises');
  const setMetricOverviewSlot = dispatchSetMetricOverviewSlot();

  const exerciseWorkoutMap = useMemo(() => {
    return new Map(
      exercises.map((exercise) => {
        const currentWorkouts = trainingsWorkouts.filter((workout) => workout.exerciseId === exercise.id);
        const lastWorkouts = previousWorkouts.filter((workout) => workout.exerciseId === exercise.id);
        return [
          exercise,
          {
            currentWorkoutSets: currentWorkouts.flatMap((workout) => workout.sets),
            lastWorkoutSets: lastWorkouts.flatMap((workout) => workout.sets),
            currentWorkoutsCount: currentWorkouts.length,
            lastWorkoutsCount: lastWorkouts.length,
          } satisfies WorkoutSetMap,
        ];
      }),
    );
  }, [exercises, previousWorkouts, trainingsWorkouts]);

  const exerciseMetricMap = useMemo(() => {
    return new Map(Array.from(exerciseWorkoutMap).map(([exercise, workout]) => [exercise, calculateMetricComparisons(workout)]));
  }, [exerciseWorkoutMap]);

  const muscleMetricMap = useMemo(() => calculateMetricComparisonsForMuscle(exerciseWorkoutMap), [exerciseWorkoutMap]);

  const activeMetricSlots = metricSelector?.section === 'muscles' ? muscleMetrics : exerciseMetrics;
  const selectedMetric = metricSelector ? activeMetricSlots[metricSelector.slotIndex] : undefined;

  return (
    <>
      <Card style={styles.card}>
        <Card.Title title="Muscle Overview" />
        <Card.Content>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.flexL}>Muscle</DataTable.Title>
              {muscleMetrics.map((metric, index) => (
                <DataTable.Title
                  key={`${metric}-${index}`}
                  style={getMetricColumnStyle(index)}
                  numeric
                  numberOfLines={2}
                  accessibilityLabel={metric}
                  accessible={true}
                  onPress={() => setMetricSelector({section: 'muscles', slotIndex: index})}
                  testID={`metrics-muscles-header-${index}`}
                >
                  {metric}
                </DataTable.Title>
              ))}
            </DataTable.Header>
            {Array.from(muscleMetricMap)
              .sort(([muscleA], [muscleB]) => muscleA.localeCompare(muscleB))
              .map(([muscle, workout]) => (
                <DataTable.Row key={muscle}>
                  <DataTable.Cell style={styles.flexL}>{muscle}</DataTable.Cell>
                  {muscleMetrics.map((metric, index) => (
                    <DataTable.Cell
                      key={`${muscle}-${metric}-${index}`}
                      style={getMetricColumnStyle(index)}
                      numeric
                      onPress={() =>
                        setSelectedMuscle({
                          muscle,
                          metric,
                        })
                      }
                    >
                      <MetricView comparison={workout.get(metric)!!} />
                    </DataTable.Cell>
                  ))}
                </DataTable.Row>
              ))}
          </DataTable>
        </Card.Content>
      </Card>

      {showExercises && (
        <ExerciseMetricOverview exerciseMetricMap={exerciseMetricMap} metrics={exerciseMetrics} onMetricHeaderPress={(slotIndex) => setMetricSelector({section: 'exercises', slotIndex})} />
      )}

      <EditDialogScaffold
        visible={selectedMuscle !== undefined}
        onDismiss={() => setSelectedMuscle(undefined)}
        title={selectedMuscle ? `${selectedMuscle.muscle} ${selectedMuscle.metric} Contribution` : ''}
        testID="muscle-contribution-dialog"
        dismissTestID="muscle-contribution-close"
        scrollable
      >
        <DataTable>
              <DataTable.Header>
                <DataTable.Title style={styles.flexL}>Exercise</DataTable.Title>
                <DataTable.Title style={styles.flexM} numeric>
                  Value
                </DataTable.Title>
                <DataTable.Title style={styles.flexS} numeric>
                  Factor
                </DataTable.Title>
                <DataTable.Title style={styles.flexS} numeric>
                  Result
                </DataTable.Title>
              </DataTable.Header>
              {Array.from(exerciseWorkoutMap).map(([exercise, workout]) => {
                const matchedExercise = exercise.muscles?.find((muscle) => muscle.muscle === selectedMuscle?.muscle) as MusclePercentPair | undefined;

                if (!matchedExercise || !selectedMuscle) {
                  return null;
                }

                const unmodifiedMetricValue = calculateMetricValue(workout.currentWorkoutSets, selectedMuscle.metric, workout.currentWorkoutsCount) ?? 0;
                const percent = [Metric.SETS, Metric.VOLUME, Metric.REPS, Metric.FREQUENCY].includes(selectedMuscle.metric) ? matchedExercise.percent ?? 0 : 100;

                return (
                  <DataTable.Row key={`${exercise.id}-${selectedMuscle.muscle}`}>
                    <DataTable.Cell style={styles.flexL}>
                      <Text>{exercise.name}</Text>
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.flexM} numeric>
                      {unmodifiedMetricValue}
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.flexS} numeric>
                      {percent}
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.flexS} numeric>
                      {(unmodifiedMetricValue * percent) / 100}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
      </EditDialogScaffold>

      {metricSelector && selectedMetric && (
        <MetricSelectionDialog
          title={`Select ${metricSelector.section === 'muscles' ? 'muscle' : 'exercise'} metric`}
          visible={metricSelector !== undefined}
          selectedMetric={selectedMetric}
          onDismiss={() => setMetricSelector(undefined)}
          onSelect={(metric) => {
            setMetricOverviewSlot(metricSelector.section, metricSelector.slotIndex, metric);
            setMetricSelector(undefined);
          }}
        />
      )}
    </>
  );
};

const getMetricColumnStyle = (index: number) => {
  return index === 0 ? styles.flexM : styles.flexS;
};

const styles = StyleSheet.create({
  card: {
    margin: 5,
  },
  flexL: {
    flex: 10,
  },
  flexM: {
    flex: 7,
  },
  flexS: {
    flex: 6,
  },
});

export default MetricsOverviewForWorkouts;
