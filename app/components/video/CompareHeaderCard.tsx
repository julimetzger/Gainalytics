import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {VideoAnalysis} from '../../models/entities/VideoAnalysis';
import {useExercise} from '../../redux/Exercises/use/useExercise';
import {useWorkoutById} from '../../redux/Workout/use/useWorkoutById';
import {formatVideoAnalysisRelativeDateTime, formatVideoAnalysisWeightLabel} from '../../utils/video-analysis-presentation';
import {
  SetVelocityAggregate,
  computeVelocityDelta,
  formatVelocityDelta,
  formatVelocityValue,
  velocityUnitFor,
} from '../../utils/videoAnalysisSetAggregates';

interface Props {
  analysisA: VideoAnalysis;
  analysisB: VideoAnalysis;
  aggregateA: SetVelocityAggregate;
  aggregateB: SetVelocityAggregate;
  metersPerPixelA?: number;
  metersPerPixelB?: number;
}

/**
 * KPI header for the Compare Analyses screen: per analysis exercise,
 * load × reps and date, plus set-aggregated Mean/Peak velocity with a
 * sign-correct, colored Δ (B − A) between both analyses.
 */
const CompareHeaderCard = ({analysisA, analysisB, aggregateA, aggregateB, metersPerPixelA, metersPerPixelB}: Props) => {
  const theme = useTheme();
  const workoutA = useWorkoutById(analysisA.workoutId);
  const workoutB = useWorkoutById(analysisB.workoutId);
  const exerciseA = useExercise(analysisA.exerciseId ?? workoutA?.exerciseId);
  const exerciseB = useExercise(analysisB.exerciseId ?? workoutB?.exerciseId);

  const loadLabelFor = (analysis: VideoAnalysis, workout: ReturnType<typeof useWorkoutById>, aggregate: SetVelocityAggregate): string => {
    const linkedSet = workout?.sets.find((set) => set.index === analysis.setIndex);
    const label = formatVideoAnalysisWeightLabel(linkedSet?.weight, linkedSet?.reps ?? aggregate.repCount);
    return label.length > 0 ? label : '—';
  };

  const deltaCell = (deltaResult: ReturnType<typeof computeVelocityDelta>, testID: string) => {
    if (!deltaResult) {
      return (
        <Text variant="bodySmall" testID={testID} style={[styles.deltaCell, {color: theme.colors.onSurfaceVariant}]}>
          —
        </Text>
      );
    }
    const color = deltaResult.delta === 0 ? theme.colors.onSurfaceVariant : deltaResult.delta > 0 ? theme.colors.primary : theme.colors.error;
    return (
      <Text variant="bodySmall" testID={testID} style={[styles.deltaCell, {color}]}>
        {formatVelocityDelta(deltaResult.delta, deltaResult.unit)}
      </Text>
    );
  };

  const meanDelta = computeVelocityDelta(aggregateA.meanVAvgPxPerS, aggregateB.meanVAvgPxPerS, metersPerPixelA, metersPerPixelB);
  const peakDelta = computeVelocityDelta(aggregateA.peakVPeakPxPerS, aggregateB.peakVPeakPxPerS, metersPerPixelA, metersPerPixelB);
  const unitA = velocityUnitFor(metersPerPixelA);
  const unitB = velocityUnitFor(metersPerPixelB);

  const infoRow = (label: string, valueA: string, valueB: string, testIDBase: string) => (
    <View style={styles.row}>
      <Text variant="labelSmall" style={[styles.labelCell, {color: theme.colors.onSurfaceVariant}]}>
        {label}
      </Text>
      <Text variant="bodySmall" testID={`${testIDBase}-a`} style={styles.valueCell} numberOfLines={1}>
        {valueA}
      </Text>
      <Text variant="bodySmall" testID={`${testIDBase}-b`} style={styles.valueCell} numberOfLines={1}>
        {valueB}
      </Text>
      <View style={styles.deltaCell} />
    </View>
  );

  const velocityRow = (
    label: string,
    valueA: number | null,
    valueB: number | null,
    delta: ReturnType<typeof computeVelocityDelta>,
    testIDBase: string,
  ) => (
    <View style={styles.row}>
      <Text variant="labelSmall" style={[styles.labelCell, {color: theme.colors.onSurfaceVariant}]}>
        {label}
      </Text>
      <Text variant="bodySmall" testID={`${testIDBase}-a`} style={styles.valueCell}>
        {valueA !== null ? `${formatVelocityValue(valueA, metersPerPixelA)} ${unitA}` : '—'}
      </Text>
      <Text variant="bodySmall" testID={`${testIDBase}-b`} style={styles.valueCell}>
        {valueB !== null ? `${formatVelocityValue(valueB, metersPerPixelB)} ${unitB}` : '—'}
      </Text>
      {deltaCell(delta, `${testIDBase}-delta`)}
    </View>
  );

  return (
    <Card style={styles.card} testID="compare-header-card">
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.labelCell} />
          <Text variant="titleSmall" style={[styles.valueCell, styles.columnTitle, {color: theme.colors.primary}]}>
            {`A #${analysisA.id}`}
          </Text>
          <Text variant="titleSmall" style={[styles.valueCell, styles.columnTitle, {color: theme.colors.tertiary}]}>
            {`B #${analysisB.id}`}
          </Text>
          <Text variant="titleSmall" style={[styles.deltaCell, styles.columnTitle, {color: theme.colors.onSurfaceVariant}]}>
            Δ
          </Text>
        </View>
        {infoRow('Exercise', exerciseA?.name ?? 'Unknown', exerciseB?.name ?? 'Unknown', 'compare-header-exercise')}
        {infoRow(
          'Load',
          loadLabelFor(analysisA, workoutA, aggregateA),
          loadLabelFor(analysisB, workoutB, aggregateB),
          'compare-header-load',
        )}
        {infoRow(
          'Date',
          formatVideoAnalysisRelativeDateTime(analysisA.createdAt),
          formatVideoAnalysisRelativeDateTime(analysisB.createdAt),
          'compare-header-date',
        )}
        {velocityRow('Mean Vel.', aggregateA.meanVAvgPxPerS, aggregateB.meanVAvgPxPerS, meanDelta, 'compare-header-mean')}
        {velocityRow('Peak Vel.', aggregateA.peakVPeakPxPerS, aggregateB.peakVPeakPxPerS, peakDelta, 'compare-header-peak')}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 10,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
    gap: 6,
  },
  labelCell: {
    width: 64,
  },
  valueCell: {
    flex: 1,
  },
  deltaCell: {
    width: 58,
    textAlign: 'right',
    fontWeight: '600',
  },
  columnTitle: {
    fontWeight: '700',
  },
});

export default CompareHeaderCard;
