import React, {useMemo} from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import {Button, Card, Text, useTheme} from 'react-native-paper';
import {LineChart} from 'react-native-charts-wrapper';
import {useHealthConnectActions, useHealthConnectState} from '../../redux/HealthConnect/use/useHealthConnect';
import {latestWeight, weightOriginName} from '../../utils/healthConnect/bodyWeight';
import {HC_PERMISSION, HealthConnectWeight} from '../../utils/healthConnect/healthConnectNative';
import {getDateStringFromDate} from '../../utils/DateHelper';

export const formatHealthConnectKg = (kg: number) => `${kg.toFixed(1)} kg`;

interface Props {
  /** Body weights from Health Connect, oldest first. */
  weights: HealthConnectWeight[];
}

/**
 * GH-528 (T3): body weight from Health Connect on the Body Weight screen: current value, where it
 * came from, chart and the hint about the 30-day limit. The history rows follow as list items.
 */
const HealthConnectBodyWeightHeader = ({weights}: Props) => {
  const theme = useTheme();
  const {status, bodyWeights} = useHealthConnectState();
  const {requestHistory} = useHealthConnectActions();

  const current = useMemo(() => latestWeight(weights), [weights]);
  const chartValues = useMemo(() => weights.map((w) => ({x: w.time, y: w.kg})), [weights]);

  const historyGranted = status?.sdkStatus === 'AVAILABLE' && status.granted.includes(HC_PERMISSION.READ_HISTORY);
  const historyAvailable = status?.sdkStatus === 'AVAILABLE' && status.historyReadAvailable;

  return (
    <View style={styles.container} testID="body-weight-hc-section">
      <Card style={styles.card} testID="body-weight-current-card">
        <Card.Content>
          <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
            FROM HEALTH CONNECT
          </Text>
          {current ? (
            <>
              <Text variant="headlineMedium" testID="body-weight-hc-current">
                {formatHealthConnectKg(current.kg)}
              </Text>
              <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}} testID="body-weight-current-origin">
                {getDateStringFromDate(current.time)} · from {weightOriginName(current)}
              </Text>
            </>
          ) : (
            <Text style={styles.empty} testID="body-weight-hc-empty">
              {bodyWeights?.error ? `Could not read Health Connect: ${bodyWeights.error}` : 'No body weight in Health Connect yet. Values from a connected scale or health app appear here.'}
            </Text>
          )}
        </Card.Content>
      </Card>
      {chartValues.length > 1 && (
        <LineChart
          style={styles.chart}
          testID="body-weight-hc-chart"
          data={{
            dataSets: [
              {
                label: 'Body weight',
                values: chartValues,
                config: {color: processColor(theme.colors.primary), circleColor: processColor(theme.colors.primary), lineWidth: 2, drawValues: false, circleRadius: 3, drawCircleHole: false},
              },
            ],
          }}
          legend={{enabled: false}}
          chartDescription={{text: ''}}
          xAxis={{valueFormatter: 'date', valueFormatterPattern: 'dd MMM yy', position: 'BOTTOM', textColor: processColor(theme.colors.onBackground)}}
          yAxis={{left: {textColor: processColor(theme.colors.onBackground)}, right: {enabled: false}}}
        />
      )}
      {!historyGranted && (
        <Card mode="outlined" style={styles.card} testID="body-weight-history-card">
          <Card.Content>
            <Text variant="bodySmall">
              {historyAvailable
                ? 'Health Connect only shares data from the last 30 days before you connected. Allow access to older data to see your whole history.'
                : 'This Health Connect version only shares data from the last 30 days before you connected.'}
            </Text>
            {historyAvailable && (
              <Button mode="contained-tonal" style={styles.button} onPress={requestHistory} testID="body-weight-request-history">
                Show older history
              </Button>
            )}
          </Card.Content>
        </Card>
      )}
      {weights.length > 0 && (
        <Text variant="titleSmall" style={styles.listTitle}>
          History ({weights.length})
        </Text>
      )}
    </View>
  );
};

interface RowProps {
  item: HealthConnectWeight;
  index: number;
}

export const HealthConnectWeightRow = ({item, index}: RowProps) => {
  const theme = useTheme();
  return (
    <View style={[styles.row, {borderBottomColor: theme.colors.outlineVariant}]} testID={`body-weight-row-${index}`}>
      <Text style={styles.rowDate}>{getDateStringFromDate(item.time)}</Text>
      <Text style={styles.rowKg}>{formatHealthConnectKg(item.kg)}</Text>
      <Text style={[styles.rowOrigin, {color: theme.colors.onSurfaceVariant}]} numberOfLines={1}>
        {weightOriginName(item)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 16,
  },
  card: {
    marginBottom: 12,
  },
  chart: {
    height: 220,
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  empty: {
    marginTop: 4,
  },
  listTitle: {
    marginHorizontal: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowDate: {
    flex: 1.4,
  },
  rowKg: {
    flex: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  rowOrigin: {
    flex: 1.4,
    textAlign: 'right',
  },
});

export default HealthConnectBodyWeightHeader;
