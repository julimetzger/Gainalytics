import React, {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import DropdownChip, {DropdownChipOption} from '../../shared/DropdownChip';
import {MicroPlanCompare, useMicroPlannedMuscleInvolvement} from '../../../redux/Training/use/useMuscleInvolvement';
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

/** Reference label in the header row — names what the planned bars are measured against. */
export const microPlanCompareLabel = (compare: MicroPlanCompare, micro: number, referenceUnavailable: boolean): string => {
  if (compare === 'none') return 'NONE';
  if (compare === 'done') return referenceUnavailable ? 'NOTHING TRAINED YET' : 'THIS MICRO (DONE)';
  return referenceUnavailable ? 'NO PREVIOUS PLAN' : `MICRO ${micro - 1} PLAN`;
};

/**
 * GH-417 — the muscle map of the whole micro's PLANNED load. GH-436 moved it
 * from the analysis of a single training into the Overview's Plan position,
 * where it is compared against what was actually trained in the micro by
 * default; the previous micro's plan stays available as a second reference.
 * MuscleInvolvementCard covers the single-training case; this one uses the same
 * bar rendering and the same persisted metric setting, only with the micro
 * aggregation as its subject.
 */
const MicroMuscleMapCard = ({trainingsPlanId, micro}: MicroMuscleMapCardProps) => {
  const theme = useTheme();
  const settings = useSettings();
  const setMetric = dispatchSetPlanMuscleMapMetric();
  const [compare, setCompare] = useState<MicroPlanCompare>('done');

  const metric: MuscleMapMetric = settings.plan?.muscleMap?.metric === 'volume' ? 'volume' : 'sets';
  const data = useMicroPlannedMuscleInvolvement(trainingsPlanId, micro, metric, compare);

  const compareOptions = useMemo<DropdownChipOption<MicroPlanCompare>[]>(
    () => [
      {value: 'done', label: 'Trained this micro'},
      {value: 'last_plan', label: micro >= 2 ? `Micro ${micro - 1} plan` : 'No previous plan', disabled: micro < 2},
      {value: 'none', label: 'None'},
    ],
    [micro],
  );

  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;

  return (
    <View testID="micro-muscle-map-card" style={[styles.card, {backgroundColor: surfaceContainer}]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, {color: onSurfaceVariant}]}>THIS MICRO (PLANNED)</Text>
        <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>·</Text>
        <DropdownChip<MuscleMapMetric> testID="micro-muscle-map-metric-chip" value={metric} options={METRIC_OPTIONS} onChange={setMetric} />
        <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>vs</Text>
        <DropdownChip<MicroPlanCompare> testID="micro-muscle-map-compare-chip" value={compare} options={compareOptions} onChange={setCompare} />
      </View>
      <Text testID="micro-muscle-map-compare-label" style={[styles.compareLabel, {color: onSurfaceVariant}]}>
        {microPlanCompareLabel(compare, micro, data.referenceUnavailable)}
      </Text>

      {data.rows.length === 0 ? (
        <Text testID="micro-muscle-map-empty" style={[styles.hint, {color: onSurfaceVariant}]}>
          No planned muscle data for this micro yet.
        </Text>
      ) : (
        <MuscleMapBarList rows={data.rows} globalMax={data.globalMax} metric={metric} showReferenceLayer={data.effectiveCompare !== 'none'} />
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
    marginBottom: 4,
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
  compareLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
});

export default MicroMuscleMapCard;
