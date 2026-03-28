import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {processColor, ScrollView, StyleSheet, View} from 'react-native';
import {BarChart, BarData, BarValue, ChartSelectEvent} from 'react-native-charts-wrapper';
import {Card, SegmentedButtons, Text, useTheme} from 'react-native-paper';
import TrainingLengthBucketDetails from '../../components/analyse/TrainingLengthBucketDetails';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {AccumulationMode} from '../../models/AccumulationMode';
import {getTrainingFromTrainingInMicroIndex} from '../../redux/Training/trainingsPlanReducer';
import {useAllTrainingsPlans} from '../../redux/Training/use/useAllTrainingsPlans';
import {useCompletedTrainingsIn} from '../../redux/Training/use/useCompletedTrainingsIn';
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from '../../utils/DateHelper';
import {
  aggregateTrainingLengths,
  formatTrainingLength,
  getTrainingLengthAxisPattern,
  getTrainingLengthBarWidth,
} from '../../utils/training-length-analysis';

interface AccumulationButtonConfig {
  label: string;
  value: AccumulationMode;
  testID: string;
}

const accumulationButtons: AccumulationButtonConfig[] = [
  {label: 'Day', value: AccumulationMode.SINGLE_DAY, testID: 'training-length-accumulation-day'},
  {label: 'Week', value: AccumulationMode.WEEK, testID: 'training-length-accumulation-week'},
  {label: 'Month', value: AccumulationMode.MONTH, testID: 'training-length-accumulation-month'},
];

const createDefaultRange = () => {
  const now = new Date();
  return new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0));
};

const TrainingLengthTab = () => {
  const theme = useTheme();
  const [range, setRange] = useState(createDefaultRange);
  const [accumulationMode, setAccumulationMode] = useState(AccumulationMode.SINGLE_DAY);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  const trainingsPlans = useAllTrainingsPlans();
  const trainings = useCompletedTrainingsIn(range);
  const trainingNameById = useMemo(
    () =>
      trainingsPlans.reduce<Record<number, string>>((accumulator, trainingsPlan) => {
        Object.entries(trainingsPlan.trainings).forEach(([trainingKey, trainingId]) => {
          if (typeof trainingId !== 'number') {
            return;
          }

          const trainingInMicro = getTrainingFromTrainingInMicroIndex(trainingKey);
          accumulator[trainingId] = trainingsPlan.trainingNames?.[trainingInMicro] ?? `Training ${trainingInMicro}`;
        });

        return accumulator;
      }, {}),
    [trainingsPlans],
  );

  const buckets = useMemo(() => aggregateTrainingLengths(trainings, accumulationMode), [accumulationMode, trainings]);

  const barValues = useMemo(
    () =>
      buckets.map((bucket) => ({
        x: bucket.x,
        y: bucket.averageDurationMinutes,
        marker: `Average ${formatTrainingLength(bucket.averageDurationMinutes)}\n${bucket.trainingCount} completed trainings`,
      })) satisfies BarValue[],
    [buckets],
  );

  const selectedBucket = useMemo(() => buckets.find((bucket) => bucket.key === selectedBucketKey) ?? null, [buckets, selectedBucketKey]);

  const chartData = useMemo(
    () =>
      ({
        dataSets: [
          {
            label: 'Training duration',
            config: {
              visible: true,
              highlightEnabled: true,
              color: processColor(theme.colors.primary),
              barShadowColor: processColor(theme.colors.primaryContainer),
              valueTextColor: processColor(theme.colors.primary),
              highlightColor: processColor(theme.colors.secondary),
              drawValues: false,
            },
            values: barValues,
          },
        ],
        config: {
          barWidth: getTrainingLengthBarWidth(accumulationMode),
        },
      }) satisfies BarData,
    [accumulationMode, barValues, theme.colors.primary, theme.colors.primaryContainer, theme.colors.secondary],
  );

  useEffect(() => {
    setSelectedBucketKey(null);
  }, [accumulationMode, range]);

  const handleAccumulationModeChange = useCallback((value: string) => {
    const selectedMode = accumulationButtons.find((button) => button.value === value)?.value;
    if (selectedMode !== undefined) {
      setAccumulationMode(selectedMode);
    }
  }, []);

  const handleBarSelect = useCallback(
    (event: ChartSelectEvent) => {
      const selectedX = event.nativeEvent?.x;
      if (typeof selectedX !== 'number') {
        return;
      }

      const selectedBucketForX = buckets.find((bucket) => Math.abs(bucket.x - selectedX) < 0.0001);
      const nextKey = selectedBucketForX?.key ?? null;
      setSelectedBucketKey((prev) => (prev === nextKey ? null : nextKey));
    },
    [buckets],
  );

  return (
    <ScrollView style={[styles.container, {backgroundColor: theme.colors.background}]} contentContainerStyle={styles.content} testID="training-length-screen">
      <Card style={styles.filterCard}>
        <Card.Content>
          <Text variant="titleMedium">Training Length</Text>
          <Text variant="bodyMedium" style={[styles.modeLabel, {color: theme.colors.onSurfaceVariant}]} testID="training-length-mode-label">
            Grouped by {accumulationMode}
          </Text>
          <SegmentedButtons
            value={accumulationMode}
            onValueChange={handleAccumulationModeChange}
            buttons={accumulationButtons.map((button) => ({...button}))}
          />
        </Card.Content>
      </Card>

      <DateRangePicker range={range} setRange={setRange} />

      {buckets.length === 0 ? (
        <Card style={styles.emptyStateCard} testID="training-length-empty-state">
          <Card.Title title="No completed trainings in this range" />
          <Card.Content>
            <Text style={{color: theme.colors.onSurfaceVariant}}>Pick a different date range to compare average completed training duration.</Text>
          </Card.Content>
        </Card>
      ) : (
        <>
          <Card style={styles.chartCard}>
            <Card.Content>
              <Text style={[styles.chartDescription, {color: theme.colors.onSurfaceVariant}]}>Average completed training duration in minutes for each selected time bucket.</Text>
              <View testID="training-length-chart">
                <BarChart
                  drawGridBackground={false}
                  data={chartData}
                  drawValueAboveBar={false}
                  borderColor={processColor(theme.colors.outline)}
                  style={styles.chart}
                  xAxis={{
                    timeUnit: 'DAYS',
                    valueFormatter: 'date',
                    valueFormatterPattern: getTrainingLengthAxisPattern(accumulationMode),
                    position: 'BOTTOM',
                    textColor: processColor(theme.colors.onBackground),
                  }}
                  yAxis={{
                    left: {textColor: processColor(theme.colors.onBackground)},
                    right: {enabled: false},
                  }}
                  legend={{enabled: false}}
                  chartDescription={{text: ''}}
                  onSelect={handleBarSelect}
                />
              </View>
            </Card.Content>
          </Card>

          {selectedBucket && (
            <TrainingLengthBucketDetails accumulationMode={accumulationMode} bucket={selectedBucket} trainingNameById={trainingNameById} />
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  filterCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  modeLabel: {
    marginTop: 4,
    marginBottom: 12,
  },
  emptyStateCard: {
    marginHorizontal: 12,
    marginTop: 8,
  },
  chartCard: {
    marginHorizontal: 12,
    marginTop: 8,
  },
  chartDescription: {
    marginBottom: 12,
  },
  chart: {
    height: 320,
  },
});

export default TrainingLengthTab;
