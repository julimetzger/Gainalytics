import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {IconButton, Text, useTheme} from 'react-native-paper';
import DropdownChip, {DropdownChipOption} from '../../shared/DropdownChip';
import {useMuscleInvolvement} from '../../../redux/Training/use/useMuscleInvolvement';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {
  dispatchSetPlanMuscleMapCompare,
  dispatchSetPlanMuscleMapEnabled,
  dispatchSetPlanMuscleMapMetric,
} from '../../../redux/settings/dispatch/dispatchSetPlanMuscleMap';
import {MuscleMapCompare, MuscleMapMetric, formatMetricValue} from '../../../utils/MuscleInvolvementUtils';

interface MuscleInvolvementCardProps {
  trainingsPlanId: number;
  micro: number;
  trainingInMicro: number;
  onDismiss?: () => void;
}

const METRIC_OPTIONS: DropdownChipOption<MuscleMapMetric>[] = [
  {value: 'sets', label: 'Sets'},
  {value: 'volume', label: 'Volume'},
];

const TINT_THRESHOLD = 0.5;
const BAR_HEIGHT = 16;
const LABEL_WIDTH = 76;
const READOUT_WIDTH = 72;

const VALID_COMPARES: MuscleMapCompare[] = ['none', 'last_plan', 'current_total_plan'];

const normalizeCompare = (raw: unknown): MuscleMapCompare => {
  if (typeof raw === 'string' && (VALID_COMPARES as string[]).includes(raw)) return raw as MuscleMapCompare;
  return 'current_total_plan';
};

const compareLabel = (compare: MuscleMapCompare, micro: number): string => {
  if (compare === 'none') return 'None';
  if (compare === 'current_total_plan') return 'Current micro plan';
  // last_plan
  const previous = Math.max(1, micro - 1);
  return `Micro ${previous} plan`;
};

const MuscleInvolvementCard = ({trainingsPlanId, micro, trainingInMicro, onDismiss}: MuscleInvolvementCardProps) => {
  const theme = useTheme();
  const settings = useSettings();
  const setEnabled = dispatchSetPlanMuscleMapEnabled();
  const setMetric = dispatchSetPlanMuscleMapMetric();
  const setCompare = dispatchSetPlanMuscleMapCompare();

  const metric: MuscleMapMetric = settings.plan?.muscleMap?.metric === 'volume' ? 'volume' : 'sets';
  const compare: MuscleMapCompare = normalizeCompare(settings.plan?.muscleMap?.compare);

  const previousMicroAvailable = micro >= 2;

  const compareOptions = useMemo<DropdownChipOption<MuscleMapCompare>[]>(
    () => [
      {value: 'none', label: 'None'},
      {
        value: 'last_plan',
        label: previousMicroAvailable ? `Micro ${micro - 1} plan` : 'No previous plan',
        disabled: !previousMicroAvailable,
      },
      {value: 'current_total_plan', label: 'Current micro plan'},
    ],
    [micro, previousMicroAvailable],
  );

  const data = useMuscleInvolvement({trainingsPlanId, micro, trainingInMicro, metric, compare});

  const handleDismiss = () => {
    setEnabled(false);
    onDismiss?.();
  };

  const surfaceContainer = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.elevation?.level1 ?? theme.colors.surfaceVariant;
  const surfaceContainerHighest = (theme.colors as unknown as {surfaceContainerHighest?: string}).surfaceContainerHighest ?? theme.colors.elevation?.level3 ?? theme.colors.surfaceVariant;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;
  const primary = theme.colors.primary;
  const tertiary = theme.colors.tertiary;

  const showReferenceLayer = data.effectiveCompare !== 'none';

  return (
    <View testID="muscle-involvement-card" style={[styles.card, {backgroundColor: surfaceContainer}]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerLabel, {color: onSurfaceVariant}]}>THIS TRAINING</Text>
          <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>·</Text>
          <DropdownChip<MuscleMapMetric>
            testID="muscle-map-metric-chip"
            value={metric}
            options={METRIC_OPTIONS}
            onChange={setMetric}
          />
          <Text style={[styles.headerSeparator, {color: onSurfaceVariant}]}>vs</Text>
          <DropdownChip<MuscleMapCompare>
            testID="muscle-map-compare-chip"
            value={compare}
            options={compareOptions}
            onChange={setCompare}
          />
        </View>
        <IconButton
          testID="muscle-map-dismiss"
          icon="close"
          size={20}
          onPress={handleDismiss}
          accessibilityLabel="Dismiss muscle map"
        />
      </View>

      <Text testID="muscle-map-compare-label" style={[styles.compareLabel, {color: onSurfaceVariant}]}>
        {compareLabel(data.effectiveCompare, micro)}
      </Text>

      {data.referenceUnavailable && (
        <Text testID="muscle-map-no-reference" style={[styles.hint, {color: onSurfaceVariant}]}>
          No reference available — showing this training only.
        </Text>
      )}

      {data.rows.length === 0 ? (
        <Text testID="muscle-map-empty" style={[styles.hint, {color: onSurfaceVariant}]}>
          No muscle data for this training yet.
        </Text>
      ) : (
        <View>
          {data.rows.map((row) => {
            const todayRatio = data.globalMax > 0 ? row.today / data.globalMax : 0;
            const refRatio = data.globalMax > 0 ? row.reference / data.globalMax : 0;
            const showThisReference = showReferenceLayer && row.reference > 0;
            const isUnderTarget = showThisReference && row.today < row.reference * TINT_THRESHOLD;
            const todayColor = isUnderTarget ? tertiary : primary;

            const showTicks = showThisReference && metric === 'sets';
            const tickCount = showTicks ? Math.max(0, Math.floor(row.reference) - 1) : 0;

            const readout = showThisReference
              ? `${formatMetricValue(row.today, metric)}/${formatMetricValue(row.reference, metric)}`
              : formatMetricValue(row.today, metric);

            return (
              <View key={row.muscleGroupId} style={styles.row} testID={`muscle-row-${row.muscleGroupId}`}>
                <Text style={[styles.rowLabel, {color: theme.colors.onSurface}]} numberOfLines={1}>
                  {row.label}
                </Text>
                <View style={[styles.barContainer, {height: BAR_HEIGHT}]}>
                  {showThisReference && (
                    <View
                      testID={`muscle-row-${row.muscleGroupId}-reference-bar`}
                      style={[
                        styles.referenceBar,
                        {width: `${Math.max(0, Math.min(1, refRatio)) * 100}%`, backgroundColor: surfaceContainerHighest},
                      ]}
                    />
                  )}
                  {showTicks && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.tickContainer,
                        {width: `${Math.max(0, Math.min(1, refRatio)) * 100}%`},
                      ]}
                    >
                      {Array.from({length: tickCount}).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.tick,
                            {
                              left: `${((i + 1) / row.reference) * 100}%`,
                              backgroundColor: onSurfaceVariant,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                  <View
                    testID={`muscle-row-${row.muscleGroupId}-today-bar`}
                    style={[
                      styles.todayBar,
                      {
                        width: `${Math.max(0, Math.min(1, todayRatio)) * 100}%`,
                        backgroundColor: todayColor,
                      },
                    ]}
                  />
                </View>
                <View style={styles.readoutContainer}>
                  <Text style={[styles.readout, {color: theme.colors.onSurface}]} numberOfLines={1}>
                    {readout}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
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
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
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
    fontStyle: 'italic',
    marginBottom: 6,
    marginLeft: 2,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    width: LABEL_WIDTH,
    fontSize: 12,
  },
  barContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    marginHorizontal: 8,
    overflow: 'hidden',
    borderRadius: 4,
  },
  referenceBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  todayBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  tickContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  readoutContainer: {
    width: READOUT_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  readout: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontFamily: 'monospace',
  },
});

export default MuscleInvolvementCard;
