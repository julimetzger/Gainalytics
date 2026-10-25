import {Stage, useProgressiveLimit} from '../common/ProgressiveMount';
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
import {useOverviewMuscles} from '../../redux/settings/use/useMuscles';
import MetricSelectionDialog from './MetricSelectionDialog';
import {describeComparisonPeriod, formatMetricValue, getMetricHeaderLabel} from '../../utils/metric-format';

export interface Comparison {
  value: number;
  difference?: number;
  /** GH-526: vs the whole micro the delta reads as the value's share of the reference. */
  share?: number;
}

/** GH-526 — what the second line of every cell shows: the delta, or the share of the reference. */
export type DeltaMode = 'diff' | 'share';

/** Shares only add up for counted metrics; an average or a maximum has no "part of the micro". */
const SHARE_METRICS = [Metric.SETS, Metric.VOLUME, Metric.REPS];

const toShares = (comparisons: Map<Metric, Comparison>): Map<Metric, Comparison> =>
  new Map(
    Array.from(comparisons).map(([metric, comparison]) => {
      const reference = comparison.difference === undefined ? undefined : comparison.value - comparison.difference;
      const share = SHARE_METRICS.includes(metric) && reference !== undefined && reference > 0 ? comparison.value / reference : undefined;
      return [metric, {value: comparison.value, share}];
    }),
  );

interface WorkoutSetOverviewProps {
  trainingsWorkouts: Workout[];
  previousWorkouts?: Workout[];
  showExercises?: boolean;
  /**
   * GH-458 (H7): names the period every delta in this table is measured
   * against. Without it a red `-176680.58` says nothing about what it compares.
   */
  comparisonRangeLabel?: string;
  /** GH-458 (H3): rendered instead of the empty tables when there is nothing to show. */
  emptyState?: React.ReactNode;
  /**
   * GH-526: names the reference of an overview (`Plan`, `Micro 1`) — the deltas
   * follow the chip the overview has selected. Shown as `Δ vs <label>`, or
   * `Share of <label>` with deltaMode 'share'.
   */
  referenceLabel?: string;
  deltaMode?: DeltaMode;
}

interface MuscleDetails {
  muscle: Muscles;
  metric: Metric;
}

interface MetricSelectorState {
  section: MetricOverviewSection;
  slotIndex: number;
}

const MetricsOverviewForWorkouts = ({trainingsWorkouts, previousWorkouts = [], showExercises = true, comparisonRangeLabel, emptyState, referenceLabel, deltaMode = 'diff'}: WorkoutSetOverviewProps) => {
  const share = deltaMode === 'share';
  const exerciseIds = useMemo(() => [...new Set([...trainingsWorkouts, ...previousWorkouts].map((workout) => workout.exerciseId))], [previousWorkouts, trainingsWorkouts]);
  const exercises = useExerciseByIds(exerciseIds);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleDetails | undefined>(undefined);
  const [metricSelector, setMetricSelector] = useState<MetricSelectorState | undefined>(undefined);
  const muscleMetrics = useMetricOverviewSlots('muscles');
  const exerciseMetrics = useMetricOverviewSlots('exercises');
  const setMetricOverviewSlot = dispatchSetMetricOverviewSlot();
  const overviewMuscles = useOverviewMuscles();

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
    // GH-526: a share lists only what the subject itself trains — the rest of the
    // micro is the denominator, not a row. The muscle totals below still sum every
    // exercise of the reference, otherwise the share of a muscle would only count
    // the exercises this training happens to contain.
    const entries = Array.from(exerciseWorkoutMap).filter(([, workout]) => !share || (workout.currentWorkoutsCount ?? 0) > 0);
    return new Map(
      entries.map(([exercise, workout]) => {
        const comparisons = calculateMetricComparisons(workout);
        return [exercise, share ? toShares(comparisons) : comparisons];
      }),
    );
  }, [exerciseWorkoutMap, share]);

  const muscleMetricMap = useMemo(() => {
    // GH-523: only the muscles the user shows in overviews.
    const shown = new Set(overviewMuscles);
    const comparisons = Array.from(calculateMetricComparisonsForMuscle(exerciseWorkoutMap)).filter(([muscle]) => shown.has(muscle));
    if (!share) return new Map(comparisons);
    return new Map(
      comparisons
        .filter(([, byMetric]) => (byMetric.get(Metric.SETS)?.value ?? 0) > 0)
        .map(([muscle, byMetric]) => [muscle, toShares(byMetric)]),
    );
  }, [exerciseWorkoutMap, share, overviewMuscles]);

  const activeMetricSlots = metricSelector?.section === 'muscles' ? muscleMetrics : exerciseMetrics;
  const selectedMetric = metricSelector ? activeMetricSlots[metricSelector.slotIndex] : undefined;
  const comparisonSubtitle = referenceLabel
    ? describeReference(referenceLabel, deltaMode)
    : comparisonRangeLabel
    ? describeComparisonPeriod(comparisonRangeLabel)
    : undefined;

  // GH-458 round 2 (review #1): this used to gate on `muscleMetricMap`/
  // `exerciseMetricMap`, which are built from trainingsWorkouts AND
  // previousWorkouts combined — so a selected period with zero sets still
  // rendered a full table of zeros whenever the COMPARISON period had data.
  // Whether the empty state shows must depend only on the selected period's
  // own sets. A workout with no sets logged (e.g. an unfinished session) is
  // "no sets" too, not "no workouts".
  const hasCurrentPeriodSets = useMemo(() => trainingsWorkouts.some((workout) => workout.sets.length > 0), [trainingsWorkouts]);

  // PERF-003: inside a ProgressiveMount (this component sits in stage 3) the first muscle rows come first,
  // the remaining rows and the exercise table one stage later (Infinity / all at once elsewhere).
  const muscleRowLimit = useProgressiveLimit(6, 100, 3);

  // GH-458 (H3): the Metrics Overview used to render bare table headers and no
  // rows when the range held nothing — indistinguishable from "still loading".
  if (emptyState && !hasCurrentPeriodSets) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <Card style={styles.card}>
        <Card.Title title="Muscle Overview" subtitle={comparisonSubtitle} subtitleNumberOfLines={2} />
        <Card.Content>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title style={styles.flexL}>Muscle</DataTable.Title>
              {muscleMetrics.map((metric, index) => (
                <DataTable.Title
                  key={`${metric}-${index}`}
                  style={getMetricColumnStyle(index)}
                  numeric
                  numberOfLines={3}
                  accessibilityLabel={getMetricHeaderLabel(metric, 'muscles')}
                  accessible={true}
                  onPress={() => setMetricSelector({section: 'muscles', slotIndex: index})}
                  testID={`metrics-muscles-header-${index}`}
                >
                  {getMetricHeaderLabel(metric, 'muscles')}
                </DataTable.Title>
              ))}
            </DataTable.Header>
            {Array.from(muscleMetricMap)
              .sort(([muscleA], [muscleB]) => muscleA.localeCompare(muscleB))
              .slice(0, muscleRowLimit)
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
                      <MetricView comparison={workout.get(metric)!!} metric={metric} section="muscles" testID={`metrics-muscle-${muscle}-${index}`} />
                    </DataTable.Cell>
                  ))}
                </DataTable.Row>
              ))}
          </DataTable>
        </Card.Content>
      </Card>

      {showExercises && (
        <Stage at={4}>
          <ExerciseMetricOverview
            exerciseMetricMap={exerciseMetricMap}
            metrics={exerciseMetrics}
            comparisonRangeLabel={comparisonRangeLabel}
            subtitle={comparisonSubtitle}
            onMetricHeaderPress={(slotIndex) => setMetricSelector({section: 'exercises', slotIndex})}
          />
        </Stage>
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
                <DataTable.Title style={styles.flexM} numeric numberOfLines={2}>
                  {selectedMuscle ? getMetricHeaderLabel(selectedMuscle.metric, 'exercises').replace(selectedMuscle.metric, 'Value') : 'Value'}
                </DataTable.Title>
                <DataTable.Title style={styles.flexS} numeric>
                  Factor (%)
                </DataTable.Title>
                <DataTable.Title style={styles.flexS} numeric numberOfLines={2}>
                  {selectedMuscle ? getMetricHeaderLabel(selectedMuscle.metric, 'muscles').replace(selectedMuscle.metric, 'Result') : 'Result'}
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
                      {formatMetricValue(selectedMuscle.metric, unmodifiedMetricValue)}
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.flexS} numeric>
                      {percent}
                    </DataTable.Cell>
                    <DataTable.Cell style={styles.flexS} numeric>
                      {formatMetricValue(selectedMuscle.metric, (unmodifiedMetricValue * percent) / 100, 'muscles')}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
            </DataTable>
      </EditDialogScaffold>

      {metricSelector && selectedMetric && (
        <MetricSelectionDialog
          title={`Select ${metricSelector.section === 'muscles' ? 'Muscle' : 'Exercise'} Metric`}
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

export const describeReference = (referenceLabel: string, deltaMode: DeltaMode) => (deltaMode === 'share' ? `Share of ${referenceLabel}` : `Δ vs ${referenceLabel}`);

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
