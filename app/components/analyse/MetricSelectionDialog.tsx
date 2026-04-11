import React from 'react';
import {StyleSheet} from 'react-native';
import {Dialog, List, Portal, Text} from 'react-native-paper';
import {ALL_METRICS, Metric} from '../../models/Metric';

interface MetricSelectionDialogProps {
  title: string;
  visible: boolean;
  selectedMetric: Metric;
  onDismiss: () => void;
  onSelect: (metric: Metric) => void;
}

const MetricSelectionDialog = ({title, visible, selectedMetric, onDismiss, onSelect}: MetricSelectionDialogProps) => {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.currentMetric}>Current: {selectedMetric}</Text>
        </Dialog.Content>
        <Dialog.ScrollArea style={styles.scrollArea}>
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
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  currentMetric: {
    marginBottom: 8,
  },
  scrollArea: {
    maxHeight: 520,
    paddingHorizontal: 0,
  },
  option: {
    borderRadius: 12,
  },
});

export default MetricSelectionDialog;
