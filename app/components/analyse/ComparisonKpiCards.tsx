import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {Kpi} from '../../utils/overview-comparison';

interface ComparisonKpiCardsProps {
  kpis: Kpi[];
  /** Prefix of every card's testIDs: `<prefix>-<key>`, `-value`, `-reference`, `-delta`. */
  testIDPrefix: string;
}

/**
 * GH-526 — the summary cards of an Overview / analysis: `value / reference`
 * with the delta (or the share) below, all against the one reference the
 * comparison line above names.
 */
const ComparisonKpiCards = ({kpis, testIDPrefix}: ComparisonKpiCardsProps) => {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {kpis.map((kpi) => {
        const id = `${testIDPrefix}-${kpi.key}`;
        const deltaColor = kpi.sign > 0 ? theme.colors.primary : kpi.sign < 0 ? theme.colors.error : theme.colors.onSurfaceVariant;
        return (
          <Card key={kpi.key} style={styles.card} testID={id}>
            <Card.Content style={styles.content}>
              <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
                {kpi.title}
              </Text>
              <View style={styles.valueRow}>
                <Text testID={`${id}-value`} variant="titleLarge" style={styles.value}>
                  {kpi.value}
                </Text>
                {kpi.reference !== undefined && (
                  <Text testID={`${id}-reference`} variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
                    {` / ${kpi.reference}`}
                  </Text>
                )}
              </View>
              {kpi.delta !== undefined && (
                <Text testID={`${id}-delta`} variant="labelMedium" style={{color: deltaColor}}>
                  {kpi.delta}
                </Text>
              )}
            </Card.Content>
          </Card>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 3,
  },
  card: {
    flex: 1,
    margin: 3,
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  value: {
    fontWeight: '600',
  },
});

export default ComparisonKpiCards;
