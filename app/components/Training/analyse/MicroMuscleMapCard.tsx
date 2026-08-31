import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import DropdownChip, {DropdownChipOption} from '../../shared/DropdownChip';
import {useMicroPlannedMuscleInvolvement} from '../../../redux/Training/use/useMuscleInvolvement';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {dispatchSetPlanMuscleMapMetric} from '../../../redux/settings/dispatch/dispatchSetPlanMuscleMap';
import {MuscleMapMetric} from '../../../utils/MuscleInvolvementUtils';
import MuscleMapBarList from '../../analyse/MuscleMapBarList';

interface MicroMuscleMapCardProps {
  trainingsPlanId: number;
  micro: number;
}

const METRIC_OPTIONS: DropdownChipOption<MuscleMapMetric>[] = [
  {value: 'sets', label: 'Sets'},
  {value: 'volume', label: 'Volume'},
];

/**
 * GH-417 — the muscle map of the whole micro's PLANNED load, shown in the
 * analysis view's Plan position. MuscleInvolvementCard covers the single-training
 * case; this one uses the same bar rendering and the same persisted metric
 * setting, only with the micro aggregation as its subject.
 */
const MicroMuscleMapCard = ({trainingsPlanId, micro}: MicroMuscleMapCardProps) => {
  const theme = useTheme();
  const settings = useSettings();
  const setMetric = dispatchSetPlanMuscleMapMetric();

  const metric: MuscleMapMetric = settings.plan?.muscleMap?.metric === 'volume' ? 'volume' : 'sets';
  const data = useMicroPlannedMuscleInvolvement(trainingsPlanId, micro, metric);

  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;

  return (
    <View testID="micro-muscle-map-card" style={[styles.card, {backgroundColor: surfaceContainer}]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, {color: onSurfaceVariant}]}>THIS MICRO (PLANNED)</Text>
        <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>·</Text>
        <DropdownChip<MuscleMapMetric> testID="micro-muscle-map-metric-chip" value={metric} options={METRIC_OPTIONS} onChange={setMetric} />
        <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>vs</Text>
        <Text testID="micro-muscle-map-compare-label" style={[styles.headerLabel, {color: onSurfaceVariant}]}>
          {data.referenceUnavailable ? 'NO PREVIOUS PLAN' : `MICRO ${micro - 1} PLAN`}
        </Text>
      </View>

      {data.rows.length === 0 ? (
        <Text testID="micro-muscle-map-empty" style={[styles.hint, {color: onSurfaceVariant}]}>
          No planned muscle data for this micro yet.
        </Text>
      ) : (
        <MuscleMapBarList rows={data.rows} globalMax={data.globalMax} metric={metric} showReferenceLayer={!data.referenceUnavailable} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
    padding: 12,
    borderRadius: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerSeparator: {
    fontSize: 11,
    opacity: 0.7,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
});

export default MicroMuscleMapCard;
