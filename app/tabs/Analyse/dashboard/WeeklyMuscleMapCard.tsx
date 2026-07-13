import React, {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {Metric} from '../../../models/Metric';
import {Comparison} from '../../../components/analyse/MetricsOverviewForWorkouts';
import DropdownChip, {DropdownChipOption} from '../../../components/shared/DropdownChip';
import MuscleMapBarList, {MuscleMapBarRow} from '../../../components/analyse/MuscleMapBarList';
import {MuscleMapMetric, muscleLabel} from '../../../utils/MuscleInvolvementUtils';

interface WeeklyMuscleMapCardProps {
  muscleMetricMap: Map<Muscles, Map<Metric, Comparison>>;
}

const METRIC_OPTIONS: DropdownChipOption<MuscleMapMetric>[] = [
  {value: 'sets', label: 'Sets'},
  {value: 'volume', label: 'Volume'},
];

// Dashboard's calculateMetricComparisonsForMuscle reports Volume in kg; the Muscle
// Map bar list (and its tonnes-formatted readout) follows the training-scoped Muscle
// Map convention of tonnes — convert so the two "Muscle Map" sections read consistently.
const KG_PER_TONNE = 1000;

/**
 * "Muscle Map" section for the global Analyse tab (GH-367) — reuses the same
 * MuscleMapBarList visualization as the in-training Muscle Map card, fed from the
 * week-over-week muscleMetricMap DashboardTab already computes (no new calc engine).
 */
const WeeklyMuscleMapCard = ({muscleMetricMap}: WeeklyMuscleMapCardProps) => {
  const [metric, setMetric] = useState<MuscleMapMetric>('sets');

  const rows = useMemo<MuscleMapBarRow[]>(() => {
    const comparisonMetric = metric === 'sets' ? Metric.SETS : Metric.VOLUME;
    const scale = metric === 'volume' ? KG_PER_TONNE : 1;
    return Array.from(muscleMetricMap.entries())
      .map(([muscle, metrics]) => {
        const comparison = metrics.get(comparisonMetric);
        const today = (comparison?.value ?? 0) / scale;
        const last = comparison?.difference !== undefined ? (comparison.value - comparison.difference) / scale : 0;
        return {muscleGroupId: muscle, label: muscleLabel(muscle), today, reference: last};
      })
      .filter((row) => row.today > 0)
      .sort((a, b) => b.today - a.today);
  }, [muscleMetricMap, metric]);

  const globalMax = useMemo(() => rows.reduce((max, row) => Math.max(max, row.today, row.reference), 0), [rows]);

  return (
    <Card style={styles.card} testID="weekly-muscle-map-card">
      <Card.Title
        title="Muscle Map"
        right={() => (
          <DropdownChip<MuscleMapMetric>
            testID="weekly-muscle-map-metric-chip"
            value={metric}
            options={METRIC_OPTIONS}
            onChange={setMetric}
          />
        )}
      />
      <Card.Content>
        <Text style={styles.hint}>This week vs last week</Text>
        {rows.length === 0 ? (
          <Text testID="weekly-muscle-map-empty" style={styles.hint}>
            No muscle data for this week yet.
          </Text>
        ) : (
          <MuscleMapBarList rows={rows} globalMax={globalMax} metric={metric} showReferenceLayer={true} />
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
  },
  hint: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
});

export default WeeklyMuscleMapCard;
