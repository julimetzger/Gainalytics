import React from 'react';
import {StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import {Exercise} from '../../models/entities/Exercise';
import {Muscles} from '../../models/Muscles';

interface MetricsActiveFilterLabelProps {
  muscle: Muscles[];
  exercise: Exercise[];
}

export const describeMetricsFilter = (muscle: Muscles[], exercise: Exercise[]) => {
  const selectedNames = [...muscle.map(String), ...exercise.map((it) => it.name)];
  return selectedNames.length > 0 ? `Showing: ${selectedNames.join(', ')}` : 'Showing: all exercises';
};

/**
 * GH-458 (H4): the dashboard's muscle chips drill down into the Metrics
 * Overview with a muscle preselected. The picker only ever says "1 selected",
 * which is exactly the opacity the audit criticised — and it said "0 selected"
 * when the drill-down dropped the muscle on the floor.
 *
 * This sits next to the picker rather than inside the RangeSwiper pane: content
 * inside that pane is not exposed to the Android accessibility tree, so a label
 * placed there is invisible both to a screen reader and to an e2e assertion.
 */
const MetricsActiveFilterLabel = ({muscle, exercise}: MetricsActiveFilterLabelProps) => (
  <Text style={styles.label} testID="metrics-active-filter" accessible accessibilityLabel={describeMetricsFilter(muscle, exercise)}>
    {describeMetricsFilter(muscle, exercise)}
  </Text>
);

const styles = StyleSheet.create({
  label: {
    marginHorizontal: 12,
    marginTop: 8,
  },
});

export default MetricsActiveFilterLabel;
