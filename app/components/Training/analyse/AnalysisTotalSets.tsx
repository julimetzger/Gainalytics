import React from 'react';
import {StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';

/** Which data the total refers to — must match what the surrounding position shows. */
export type TotalSetsScope = 'planned' | 'done';

interface AnalysisTotalSetsProps {
  totalSets: number;
  scope: TotalSetsScope;
  /** Override when two totals share one screen (GH-436 Overview: planned next to done). */
  testID?: string;
}

/**
 * GH-417 AC4: the analysis view shows the total number of sets in BOTH toggle
 * positions. The scope is part of the label so the number can never be read
 * against the wrong data set — 'planned' is the planned sets of what the
 * position shows (a training, or in the Overview the whole micro), 'done' the
 * sets actually logged there (GH-436).
 */
export const formatTotalSets = (totalSets: number, scope: TotalSetsScope): string => `Total Sets: ${totalSets} (${scope})`;

const AnalysisTotalSets = ({totalSets, scope, testID = 'analysis-total-sets'}: AnalysisTotalSetsProps) => (
  <Text testID={testID} accessible accessibilityLabel={`${testID}-${scope}-${totalSets}`} style={styles.label}>
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
