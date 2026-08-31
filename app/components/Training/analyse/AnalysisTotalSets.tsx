import React from 'react';
import {StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';

/** Which data the total refers to — must match what the surrounding position shows. */
export type TotalSetsScope = 'planned' | 'done';

interface AnalysisTotalSetsProps {
  totalSets: number;
  scope: TotalSetsScope;
}

/**
 * GH-417 AC4: the analysis view shows the total number of sets in BOTH toggle
 * positions. The scope is part of the label so the number can never be read
 * against the wrong data set — 'planned' is the micro's planned sets, 'done'
 * the sets actually logged in this training.
 */
export const formatTotalSets = (totalSets: number, scope: TotalSetsScope): string => `Total Sets: ${totalSets} (${scope})`;

const AnalysisTotalSets = ({totalSets, scope}: AnalysisTotalSetsProps) => (
  <Text testID="analysis-total-sets" accessible accessibilityLabel={`analysis-total-sets-${scope}-${totalSets}`} style={styles.label}>
    {formatTotalSets(totalSets, scope)}
  </Text>
);

const styles = StyleSheet.create({
  label: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '600',
  },
});

export default AnalysisTotalSets;
