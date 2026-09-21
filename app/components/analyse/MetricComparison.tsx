import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import React from 'react';
import {Comparison} from './MetricsOverviewForWorkouts';
import {Metric} from '../../models/Metric';
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
  testID?: string;
}

const MetricView = ({comparison, metric, testID}: MetricComparisonProps) => {
  const theme = useTheme();
  const difference = comparison?.difference;
  const greater = (difference ?? 0) >= 0;
  const deltaColor = difference === 0 ? theme.colors.onSurfaceVariant : greater ? '#558b2f' /* green */ : theme.colors.error;

  const value = metric !== undefined ? formatMetricValue(metric, comparison?.value) : comparison?.value?.toFixed(2);
  const delta = difference === undefined ? undefined : metric !== undefined ? formatMetricDelta(metric, difference) : (greater ? '+' : '') + difference.toFixed(2);

  // GH-458 (H7): the delta used to sit ABOVE the value in full size and in a
  // loud red, so the most eye-catching element of every cell carried the less
  // important information. Value first, delta below in a smaller, muted size.
  if (metric !== undefined) {
    return (
      <View style={styles.container}>
        <Text testID={testID}>{value}</Text>
        {delta !== undefined && (
          <Text variant="labelSmall" style={[styles.delta, {color: deltaColor}]} testID={testID ? `${testID}-delta` : undefined}>
            {delta}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {delta !== undefined && <Text style={{color: difference === 0 ? theme.colors.onSurface : greater ? '#558b2f' : theme.colors.error}}>{delta}</Text>}
      <Text>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  delta: {
    marginTop: 1,
  },
});

export default MetricView;
