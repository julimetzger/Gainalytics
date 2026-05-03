import React from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {PieChart} from 'react-native-charts-wrapper';

interface CompletionRingProps {
  completed: number;
  total: number;
  size?: number;
  testID?: string;
}

const CompletionRing = ({completed, total, size = 88, testID}: CompletionRingProps) => {
  const theme = useTheme();
  const safeTotal = Math.max(total, 1);
  const safeCompleted = Math.max(0, Math.min(completed, safeTotal));
  const remaining = Math.max(0, safeTotal - safeCompleted);

  const data = {
    dataSets: [
      {
        label: '',
        values: [{value: safeCompleted}, {value: remaining > 0 ? remaining : 0.0001}],
        config: {
          colors: [
            processColor(theme.colors.primary),
            processColor(theme.colors.surfaceVariant ?? theme.colors.onSurfaceVariant),
          ],
          drawValues: false,
          valueTextSize: 0,
          sliceSpace: 0,
          selectionShift: 0,
        },
      },
    ],
  };

  return (
    <View style={[styles.wrap, {width: size, height: size}]} testID={testID}>
      <PieChart
        style={StyleSheet.absoluteFill}
        data={data}
        drawEntryLabels={false}
        holeRadius={70}
        transparentCircleRadius={70}
        holeColor={processColor(theme.colors.surface)}
        rotationEnabled={false}
        rotationAngle={270}
        legend={{enabled: false}}
        chartDescription={{text: ''}}
        usePercentValues={false}
      />
      <View style={styles.label} pointerEvents="none">
        <Text variant="titleMedium" style={{color: theme.colors.primary, fontWeight: '700'}}>
          {safeCompleted}/{total}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', justifyContent: 'center'},
  label: {position: 'absolute', alignItems: 'center', justifyContent: 'center'},
});

export default CompletionRing;
