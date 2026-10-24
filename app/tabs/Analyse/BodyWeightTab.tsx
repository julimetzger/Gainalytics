import React, {useCallback, useMemo} from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import {Button, Card, Text, useTheme} from 'react-native-paper';
import {FlashList} from '@shopify/flash-list';
import {LineChart} from 'react-native-charts-wrapper';
import {useFocusEffect} from '@react-navigation/native';
import {useBodyWeights, useHealthConnectActions, useHealthConnectConnection, useHealthConnectState} from '../../redux/HealthConnect/use/useHealthConnect';
import {latestWeight, weightOriginName} from '../../utils/healthConnect/bodyWeight';
import {canReadBodyWeight} from '../../utils/healthConnect/healthConnectStatus';
import {HC_PERMISSION, HealthConnectWeight} from '../../utils/healthConnect/healthConnectNative';
import {getDateStringFromDate} from '../../utils/DateHelper';

const formatKg = (kg: number) => `${kg.toFixed(1)} kg`;

/** GH-528 (T3): body weight from Health Connect: current value, history and where each value came from. */
const BodyWeightTab = () => {
  const theme = useTheme();
  const weights = useBodyWeights();
  const {status, bodyWeights} = useHealthConnectState();
  const connection = useHealthConnectConnection();
  const {loadWeights, requestHistory} = useHealthConnectActions();

  // Re-read on every visit: the scale app may have written a new value meanwhile.
  useFocusEffect(useCallback(() => void loadWeights(), [loadWeights]));

  const current = useMemo(() => latestWeight(weights), [weights]);
  const newestFirst = useMemo(() => [...weights].reverse(), [weights]);
  const chartValues = useMemo(() => weights.map((w) => ({x: w.time, y: w.kg})), [weights]);

  const historyGranted = status?.sdkStatus === 'AVAILABLE' && status.granted.includes(HC_PERMISSION.READ_HISTORY);
  const historyAvailable = status?.sdkStatus === 'AVAILABLE' && status.historyReadAvailable;

  if (!canReadBodyWeight(connection)) {
    return (
      <Text style={styles.message} testID="body-weight-not-connected">
        Connect Health Connect with "Read body weight" in Settings to see your body weight here.
      </Text>
    );
  }

  const header = (
    <View>
      <Card style={styles.card} testID="body-weight-current-card">
        <Card.Content>
          <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
            CURRENT BODY WEIGHT
          </Text>
          {current ? (
            <>
              <Text variant="headlineMedium" testID="body-weight-current">
                {formatKg(current.kg)}
              </Text>
              <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}} testID="body-weight-current-origin">
                {getDateStringFromDate(current.time)} · from {weightOriginName(current)}
              </Text>
            </>
          ) : (
            <Text style={styles.empty} testID="body-weight-empty">
              {bodyWeights?.error ? `Could not read Health Connect: ${bodyWeights.error}` : 'No body weight in Health Connect yet. Values from a connected scale or health app appear here.'}
            </Text>
          )}
        </Card.Content>
      </Card>
      {chartValues.length > 1 && (
        <LineChart
          style={styles.chart}
          testID="body-weight-chart"
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
      {newestFirst.length > 0 && (
        <Text variant="titleSmall" style={styles.listTitle}>
          History ({newestFirst.length})
        </Text>
      )}
    </View>
  );

  return (
    <FlashList
      data={newestFirst}
      estimatedItemSize={44}
      ListHeaderComponent={header}
      keyExtractor={(item: HealthConnectWeight) => `${item.time}-${item.origin}-${item.kg}`}
      renderItem={({item, index}: {item: HealthConnectWeight; index: number}) => (
        <View style={[styles.row, {borderBottomColor: theme.colors.outlineVariant}]} testID={`body-weight-row-${index}`}>
          <Text style={styles.rowDate}>{getDateStringFromDate(item.time)}</Text>
          <Text style={styles.rowKg}>{formatKg(item.kg)}</Text>
          <Text style={[styles.rowOrigin, {color: theme.colors.onSurfaceVariant}]} numberOfLines={1}>
            {weightOriginName(item)}
          </Text>
        </View>
      )}
      contentContainerStyle={styles.content}
      testID="body-weight-list"
    />
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 8,
    paddingBottom: 24,
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
  message: {
    padding: 16,
  },
  listTitle: {
    marginHorizontal: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
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

export default BodyWeightTab;
