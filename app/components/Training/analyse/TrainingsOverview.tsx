import {ScrollView, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import React, {useEffect, useMemo, useState} from 'react';
import MetricsOverviewForWorkouts from '../../analyse/MetricsOverviewForWorkouts';
import {Training} from '../../../models/entities/Training';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import VelocityLossInsightCard from '../VelocityLossInsightCard';
import {useVelocityLossInsights} from '../useVelocityLossInsights';
import {TrainingsState} from '../../../models/TrainingsState';
import CollapsibleSection from '../../analyse/CollapsibleSection';
import {Stage} from '../../common/ProgressiveMount';
import CompareChips from '../../analyse/CompareChips';
import ComparisonKpiCards from '../../analyse/ComparisonKpiCards';
import MuscleMapCard from '../../analyse/MuscleMapCard';
import {durationKpi, Kpi, setsKpi, trainingDurationMs, volumeKpi} from '../../../utils/overview-comparison';
import {useTrainingComparison} from './useTrainingComparison';

interface TrainingsOverviewProps {
  training: Training;
  trainingsPlan: TrainingsPlan;
  currentMicro: number;
  trainingInMicro: number;
  /** The Plan | Train toggle — GH-526 puts it at the start of the compare chip row. */
  toggle?: React.ReactNode;
}

/**
 * The "Train" position of a single training's analysis. GH-526: compares the
 * logged workouts against exactly one reference, picked with the chips next to
 * the Plan | Train toggle — this training's plan (default), the last matching
 * training, or the micro's plan (as a share). The line under the chips names
 * both sides; KPI cards, muscle map and Muscle Overview / Exercises all follow it.
 */
const TrainingsOverview = ({training, trainingsPlan, currentMicro, trainingInMicro, toggle}: TrainingsOverviewProps) => {
  const theme = useTheme();
  const trainingWorkoutIds = useMemo(() => new Set(Object.values(training.doneWorkoutIds) as number[]), [training.doneWorkoutIds]);
  const vlInsights = useVelocityLossInsights(trainingsPlan, currentMicro, trainingWorkoutIds);
  const comparison = useTrainingComparison(trainingsPlan, currentMicro, trainingInMicro, 'train', training);

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

  const mode = comparison.share ? 'share' : 'diff';
  const kpis: Kpi[] = [
    setsKpi(comparison.subject, comparison.reference, mode, comparison.referenceLabel),
    volumeKpi(comparison.subject, comparison.reference, mode, comparison.referenceLabel),
  ];
  // Duration only against the last done training — no planned duration exists.
  if (comparison.selected === 'last_training_done' || comparison.selected === undefined) {
    const reference = comparison.durationReference ? trainingDurationMs(comparison.durationReference) : undefined;
    kpis.unshift(durationKpi(trainingDurationMs(training, now), reference, isLive ? 'Duration (live)' : 'Duration'));
  }

  return (
    // Containers must not be `accessible`: that merges the whole subtree into one
    // accessibility node, hiding every value from screen readers and UI tests.
    <ScrollView testID="trainings-overview">
      <View testID="trainings-overview-root">
        <CompareChips options={comparison.options} value={comparison.selected} onChange={comparison.select} testIDPrefix="analysis-compare">
          {toggle}
        </CompareChips>
        <Text testID="analysis-comparison-line" variant="bodySmall" style={[styles.line, {color: theme.colors.onSurfaceVariant}]}>
          {comparison.comparisonLine}
        </Text>
        <ComparisonKpiCards kpis={kpis} testIDPrefix="trainings-overview" />
        {/* PERF-003: the sections below the summary cards arrive in later stages when the screen
            builds progressively (see ProgressiveMount); everywhere else all stages are on at once. */}
        <Stage at={1}>
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
                  vlReference={insight.vlReference}
                />
              ))}
            </View>
          )}
          <MuscleMapCard
            testID="analysis-muscle-map"
            subject={comparison.subject}
            reference={comparison.reference}
            share={comparison.share}
            subjectLabel={comparison.share ? 'This training' : comparison.subjectLabel}
            referenceLabel={comparison.referenceLabel}
            referenceShort={comparison.referenceShort}
            details={comparison.details}
            emptyText="No muscle data for this training yet."
          />
        </Stage>
        <Stage at={3}>
          <CollapsibleSection id="metrics" title="Metrics">
            <MetricsOverviewForWorkouts
              trainingsWorkouts={comparison.subject}
              previousWorkouts={comparison.reference ?? []}
              referenceLabel={comparison.referenceLabel}
              deltaMode={mode}
            />
          </CollapsibleSection>
        </Stage>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  line: {
    marginHorizontal: 13,
    marginTop: 6,
  },
});

export default TrainingsOverview;
