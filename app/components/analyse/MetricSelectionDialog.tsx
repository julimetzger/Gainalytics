import React from 'react';
import {StyleSheet, View} from 'react-native';
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
          <View style={styles.list}>
            {ALL_METRICS.map((metric) => (
              <List.Item
                key={metric}
                title={<Text>{metric}</Text>}
                onPress={() => onSelect(metric)}
                testID={`metric-selector-option-${metric
                  .toLowerCase()
                  .replace(/\s+/g, '-')
                  .replace(/[^a-z0-9-]/g, '')}`}
                style={styles.option}
                right={(props) => (selectedMetric === metric ? <List.Icon {...props} icon="check" /> : null)}
              />
            ))}
          </View>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  currentMetric: {
    marginBottom: 8,
  },
  list: {
    gap: 2,
  },
  option: {
    borderRadius: 12,
  },
});

export default MetricSelectionDialog;
