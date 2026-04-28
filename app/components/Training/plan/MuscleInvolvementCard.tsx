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

const COMPARE_OPTIONS: DropdownChipOption<MuscleMapCompare>[] = [
  {value: 'micro', label: 'Micro 7'},
  {value: 'last', label: 'Last training'},
  {value: 'none', label: 'No compare'},
];

const TINT_THRESHOLD = 0.6;
const BAR_HEIGHT = 16;
const LABEL_WIDTH = 76;
const READOUT_WIDTH = 64;

const MuscleInvolvementCard = ({trainingsPlanId, micro, trainingInMicro, onDismiss}: MuscleInvolvementCardProps) => {
  const theme = useTheme();
  const settings = useSettings();
  const setEnabled = dispatchSetPlanMuscleMapEnabled();
  const setMetric = dispatchSetPlanMuscleMapMetric();
  const setCompare = dispatchSetPlanMuscleMapCompare();

  const metric: MuscleMapMetric = settings.plan?.muscleMap?.metric ?? 'sets';
  const compare: MuscleMapCompare = settings.plan?.muscleMap?.compare ?? 'micro';

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
  const errorColor = theme.colors.error;

  const barColumnWidth = useMemo(() => 0, []); // placeholder; bar is flex:1 in row layout

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
            options={COMPARE_OPTIONS}
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
            const showReference = data.effectiveCompare !== 'none' && row.reference > 0;
            const isUnderTarget = showReference && row.reference > 0 && row.today / row.reference < TINT_THRESHOLD;
            const todayColor = isUnderTarget ? tertiary : primary;

            const showTicks = data.effectiveCompare === 'micro' && metric === 'sets' && row.reference > 0;
            const tickCount = showTicks ? Math.max(0, Math.floor(row.reference) - 1) : 0;

            const showLastEndCap = data.effectiveCompare === 'last' && row.reference > 0;

            let readout: string;
            let deltaText: string | undefined;
            let deltaColor: string | undefined;

            if (data.effectiveCompare === 'micro' && row.reference > 0) {
              readout = `${formatMetricValue(row.today, metric)}/${formatMetricValue(row.reference, metric)}`;
            } else if (data.effectiveCompare === 'last' && row.reference > 0) {
              readout = formatMetricValue(row.today, metric);
              const delta = row.today - row.reference;
              const sign = delta > 0 ? '+' : '';
              deltaText = `${sign}${formatMetricValue(Math.abs(delta), metric)}`;
              if (delta > 0) deltaColor = primary;
              else if (delta < 0) deltaColor = errorColor;
              else deltaColor = onSurfaceVariant;
            } else {
              readout = formatMetricValue(row.today, metric);
            }

            return (
              <View key={row.muscleGroupId} style={styles.row} testID={`muscle-row-${row.muscleGroupId}`}>
                <Text style={[styles.rowLabel, {color: theme.colors.onSurface}]} numberOfLines={1}>
                  {row.label}
                </Text>
                <View style={[styles.barContainer, {height: BAR_HEIGHT}]}>
                  {/* Reference layer (faint bar for 'micro') */}
                  {data.effectiveCompare === 'micro' && row.reference > 0 && (
                    <View
                      style={[
                        styles.referenceBar,
                        {width: `${Math.max(0, Math.min(1, refRatio)) * 100}%`, backgroundColor: surfaceContainerHighest},
                      ]}
                    />
                  )}
                  {/* Tick marks for sets vs micro */}
                  {showTicks && row.reference > 0 && (
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
                  {/* Today bar */}
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
                  {/* Last end-cap line */}
                  {showLastEndCap && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.lastEndCap,
                        {
                          left: `${Math.max(0, Math.min(1, refRatio)) * 100}%`,
                          backgroundColor: onSurfaceVariant,
                        },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.readoutContainer}>
                  <Text style={[styles.readout, {color: theme.colors.onSurface}]} numberOfLines={1}>
                    {readout}
                  </Text>
                  {deltaText !== undefined && (
                    <Text style={[styles.delta, {color: deltaColor}]} numberOfLines={1}>
                      {deltaText}
                    </Text>
                  )}
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
    marginBottom: 8,
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
  lastEndCap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
  },
  readoutContainer: {
    width: READOUT_WIDTH,
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  readout: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontFamily: 'monospace',
  },
  delta: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default MuscleInvolvementCard;
