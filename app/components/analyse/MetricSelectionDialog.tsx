import React from 'react';
import {StyleSheet} from 'react-native';
import {List, Text, useTheme} from 'react-native-paper';
import {ALL_METRICS, Metric} from '../../models/Metric';
import EditDialogScaffold from '../common/EditDialogScaffold';

interface MetricSelectionDialogProps {
  title: string;
  visible: boolean;
  selectedMetric: Metric;
  onDismiss: () => void;
  onSelect: (metric: Metric) => void;
}

const MetricSelectionDialog = ({title, visible, selectedMetric, onDismiss, onSelect}: MetricSelectionDialogProps) => {
  const theme = useTheme();

  return (
    <EditDialogScaffold
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      testID="metric-selection-dialog"
      dismissTestID="metric-selection-close"
      scrollable
    >
      <Text style={[styles.currentMetric, {color: theme.colors.onSurfaceVariant}]}>Current: {selectedMetric}</Text>
      {ALL_METRICS.map((metric) => (
        <List.Item
          key={metric}
          title={metric}
          onPress={() => onSelect(metric)}
          testID={`metric-selector-option-${metric
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')}`}
          style={styles.option}
          right={(props) => (selectedMetric === metric ? <List.Icon {...props} icon="check" /> : null)}
        />
      ))}
    </EditDialogScaffold>
  );
};

const styles = StyleSheet.create({
  currentMetric: {
    marginBottom: 8,
  },
  option: {
    borderRadius: 12,
  },
});

export default MetricSelectionDialog;
