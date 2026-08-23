import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {MuscleMapMetric, formatMetricValue} from '../../utils/MuscleInvolvementUtils';

export interface MuscleMapBarRow {
  muscleGroupId: string;
  label: string;
  today: number;
  reference: number;
}

interface MuscleMapBarListProps {
  rows: MuscleMapBarRow[];
  globalMax: number;
  metric: MuscleMapMetric;
  showReferenceLayer: boolean;
}

const TINT_THRESHOLD = 0.5;
const BAR_HEIGHT = 16;
const LABEL_WIDTH = 76;
const READOUT_WIDTH = 72;

/**
 * Per-muscle today-vs-reference bar rendering, extracted from MuscleInvolvementCard
 * (GH-300) so the "Muscle Map" section can be reused outside a single-training context
 * (e.g. the global Analyse tab's weekly view, GH-367) without a second visualization engine.
 */
const MuscleMapBarList = ({rows, globalMax, metric, showReferenceLayer}: MuscleMapBarListProps) => {
  const theme = useTheme();
  const surfaceContainerHighest = (theme.colors as unknown as {surfaceContainerHighest?: string}).surfaceContainerHighest ?? theme.colors.elevation?.level3 ?? theme.colors.surfaceVariant;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;
  const primary = theme.colors.primary;
  const tertiary = theme.colors.tertiary;

  return (
    <View>
      {rows.map((row) => {
        const todayRatio = globalMax > 0 ? row.today / globalMax : 0;
        const refRatio = globalMax > 0 ? row.reference / globalMax : 0;
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
  );
};

const styles = StyleSheet.create({
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

export default MuscleMapBarList;
