import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';

interface StatComparisonProps {
  current: number;
  previous: number;
  unit?: string;
  testID?: string;
}

export interface TrainingOverviewStatItemProps {
  label: string;
  value: string;
  labelColor: string;
  comparison?: StatComparisonProps;
  testID?: string;
  valueTestID?: string;
}

const TrainingOverviewStatItem = ({label, value, labelColor, comparison, testID, valueTestID}: TrainingOverviewStatItemProps) => {
  const theme = useTheme();
  const difference = comparison ? comparison.current - comparison.previous : undefined;
  const comparisonColor = difference === undefined || difference === 0 ? theme.colors.onSurfaceVariant : difference > 0 ? theme.colors.primary : theme.colors.error;

  return (
    <View style={styles.statItem} testID={testID}>
      <Text style={styles.statValue} testID={valueTestID}>
        {value}
      </Text>
      <Text style={[styles.statLabel, {color: labelColor}]}>{label}</Text>
      {comparison && comparison.previous > 0 && difference !== undefined && (
        <Text testID={comparison.testID} style={[styles.comparisonText, {color: comparisonColor}]}>
          {difference > 0 ? '+' : ''}
          {difference}
          {comparison.unit ?? ''}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  statItem: {
    alignItems: 'center',
    flexBasis: '33.33%',
    maxWidth: '33.33%',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  comparisonText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default TrainingOverviewStatItem;
