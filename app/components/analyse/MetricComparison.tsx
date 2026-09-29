import {StyleSheet, View} from 'react-native';
import {MD3Theme, Text, useTheme} from 'react-native-paper';
import React, {useMemo} from 'react';
import {Comparison} from './MetricsOverviewForWorkouts';
import {Metric, MetricOverviewSection} from '../../models/Metric';
import {formatMetricDelta, formatMetricValue} from '../../utils/metric-format';

interface MetricComparisonProps {
  comparison: Comparison;
  /**
   * GH-458 (H7): when the metric is known the value is rendered in the unit its
   * column header announces, counts are rounded, and the delta is subordinated
   * to the value. Callers outside the Analyse tables omit it and keep the
   * previous plain two-decimal rendering.
   */
  metric?: Metric;
  /** Muscle counts are weighted shares and keep their decimals; exercise counts are whole. */
  section?: MetricOverviewSection;
  testID?: string;
}

const MetricView = ({comparison, metric, section, testID}: MetricComparisonProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const difference = comparison?.difference;
  const greater = (difference ?? 0) >= 0;
  // GH-458 round 2 (review #3): a hardcoded '#558b2f' stayed the same green in
  // dark theme and any custom palette, where it can read as low-contrast or
  // clash outright. `theme.colors.primary` already carries the "positive"
  // meaning elsewhere in this ticket (MuscleHeatmap's chip colouring) and is
  // tuned for both schemes by construction.
  const deltaStyle = difference === 0 ? styles.deltaNeutral : greater ? styles.deltaPositive : styles.deltaNegative;

  const value = metric !== undefined ? formatMetricValue(metric, comparison?.value, section) : comparison?.value?.toFixed(2);
  const delta = difference === undefined ? undefined : metric !== undefined ? formatMetricDelta(metric, difference, section) : (greater ? '+' : '') + difference.toFixed(2);

  // GH-458 (H7): the delta used to sit ABOVE the value in full size and in a
  // loud red, so the most eye-catching element of every cell carried the less
  // important information. Value first, delta below in a smaller, muted size.
  if (metric !== undefined) {
    return (
      <View style={styles.container}>
        <Text testID={testID}>{value}</Text>
        {delta !== undefined && (
          <Text variant="labelSmall" style={[styles.delta, deltaStyle]} testID={testID ? `${testID}-delta` : undefined}>
            {delta}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {delta !== undefined && <Text style={difference === 0 ? styles.legacyNeutral : deltaStyle}>{delta}</Text>}
      <Text>{value}</Text>
    </View>
  );
};

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      display: 'flex',
      alignItems: 'flex-end',
    },
    delta: {
      marginTop: 1,
    },
    deltaPositive: {color: theme.colors.primary},
    deltaNegative: {color: theme.colors.error},
    deltaNeutral: {color: theme.colors.onSurfaceVariant},
    legacyNeutral: {color: theme.colors.onSurface},
  });

export default MetricView;
