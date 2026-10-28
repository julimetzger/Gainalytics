import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {Chip} from 'react-native-paper';
import {ALL_METRICS, Metric} from '../../../models/Metric';

interface MetricChipsProps {
  metrics: Metric[];
  setMetrics: (metrics: Metric[]) => void;
}

export const metricTestID = (metric: Metric) => `filter-metric-${metric.replace(/ /g, '-')}`;

/** GH-642: horizontal multi-select chip row; no metric selected means all are charted (GH-468). */
const MetricChips = ({metrics, setMetrics}: MetricChipsProps) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
    {ALL_METRICS.map((metric) => {
      const selected = metrics.includes(metric);
      return (
        <Chip
          key={metric}
          testID={metricTestID(metric)}
          compact
          selected={selected}
          mode={selected ? 'flat' : 'outlined'}
          onPress={() => setMetrics(selected ? metrics.filter((it) => it !== metric) : ALL_METRICS.filter((it) => it === metric || metrics.includes(it)))}
        >
          {metric}
        </Chip>
      );
    })}
  </ScrollView>
);

export default MetricChips;

const styles = StyleSheet.create({
  row: {
    gap: 6,
  },
});
