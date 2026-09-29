import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {GestureResponderEvent, LayoutChangeEvent, PixelRatio, Pressable, processColor, ScrollView, StyleSheet, View} from 'react-native';
import {BarChart, BarData, BarValue} from 'react-native-charts-wrapper';
import {Button, Card, MD3Theme, SegmentedButtons, Text, useTheme} from 'react-native-paper';
import TrainingLengthBucketDetails from '../../components/analyse/TrainingLengthBucketDetails';
import TrainingLengthEditDialog from '../../components/analyse/TrainingLengthEditDialog';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {AccumulationMode} from '../../models/AccumulationMode';
import {getTrainingFromTrainingInMicroIndex} from '../../redux/Training/trainingsPlanReducer';
import {useAllTrainingsPlans} from '../../redux/Training/use/useAllTrainingsPlans';
import {useCompletedTrainingsIn} from '../../redux/Training/use/useCompletedTrainingsIn';
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from '../../utils/DateHelper';
import {
  CompletedTrainingLength,
  IMPLAUSIBLE_TRAINING_DURATION_MINUTES,
  aggregateTrainingLengths,
  findBucketByX,
  formatTrainingLength,
  getTrainingLengthAxisPattern,
  getTrainingLengthBarWidth,
  partitionTrainingLengths,
} from '../../utils/training-length-analysis';
import {useLastCompletedTrainingDate} from '../../redux/Training/use/useLastCompletedTrainingDate';
import AnalyseStaleRangeBanner from '../../components/analyse/AnalyseStaleRangeBanner';
import {formatTrainingLengthDate} from '../../utils/training-length-analysis';

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

const DEFAULT_CHART_WIDTH = 320;
const CHART_LEFT_PADDING = 56;
const CHART_RIGHT_PADDING = 16;
const CHART_TOP_PADDING = 8;
const CHART_BOTTOM_PADDING = 32;

const createDefaultRange = () => {
  const now = new Date();
  return new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0));
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getChartDomain = (buckets: ReturnType<typeof aggregateTrainingLengths>, accumulationMode: AccumulationMode) => {
  if (buckets.length === 0) {
    return null;
  }

  const barPadding = Math.max(1, getTrainingLengthBarWidth(accumulationMode) / 2);
  return {
    minX: buckets[0].x - barPadding,
    maxX: buckets[buckets.length - 1].x + barPadding,
  };
};

const findBucketForTouch = (buckets: ReturnType<typeof aggregateTrainingLengths>, accumulationMode: AccumulationMode, chartWidth: number, locationX: number) => {
  const chartDomain = getChartDomain(buckets, accumulationMode);
  const drawableWidth = chartWidth - CHART_LEFT_PADDING - CHART_RIGHT_PADDING;
  if (!chartDomain || drawableWidth <= 0 || locationX < CHART_LEFT_PADDING || locationX > chartWidth - CHART_RIGHT_PADDING) {
    return null;
  }

  const progress = clamp((locationX - CHART_LEFT_PADDING) / drawableWidth, 0, 1);
  const selectedX = chartDomain.minX + progress * (chartDomain.maxX - chartDomain.minX);
  return findBucketByX(buckets, selectedX);
};

const TrainingLengthTab = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [range, setRange] = useState(createDefaultRange);
  const [accumulationMode, setAccumulationMode] = useState(AccumulationMode.SINGLE_DAY);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  const [bucketForEdit, setBucketForEdit] = useState<ReturnType<typeof findBucketByX>>(null);
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH);
  // GH-458 (H6): implausible sessions are out of the scaling by default. The
  // user can put them back — the data itself is never changed.
  const [includeOutliers, setIncludeOutliers] = useState(false);
  const skipNextPressRef = useRef(false);
  const trainingsPlans = useAllTrainingsPlans();
  const trainings = useCompletedTrainingsIn(range);
  const lastCompletedTrainingDate = useLastCompletedTrainingDate();
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

  const buckets = useMemo(() => aggregateTrainingLengths(trainings, accumulationMode, !includeOutliers), [accumulationMode, includeOutliers, trainings]);
  const implausibleTrainings = useMemo(() => partitionTrainingLengths(trainings).implausibleTrainings, [trainings]);
  const onlyOutliersInRange = buckets.length === 0 && implausibleTrainings.length > 0;
  const chartDomain = useMemo(() => getChartDomain(buckets, accumulationMode), [accumulationMode, buckets]);

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
  const highlightedBars = useMemo(() => (selectedBucket ? [{x: selectedBucket.x, dataSetIndex: 0}] : []), [selectedBucket]);

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
      } satisfies BarData),
    [accumulationMode, barValues, theme.colors.primary, theme.colors.primaryContainer, theme.colors.secondary],
  );

  useEffect(() => {
    setSelectedBucketKey(null);
    setBucketForEdit(null);
    skipNextPressRef.current = false;
  }, [accumulationMode, range, includeOutliers]);

  // GH-458 (H6): correcting an implausible training used to require a long
  // press on its bar — an invisible gesture on a bar that a normal tap did
  // nothing to. The notice below carries a real button straight to the editor.
  const handleCorrectOutlier = useCallback(
    (outlier: CompletedTrainingLength) => {
      setBucketForEdit({
        key: outlier.key,
        startDate: outlier.start,
        x: 0,
        averageDurationMinutes: outlier.durationMinutes,
        totalDurationMinutes: outlier.durationMinutes,
        trainingCount: 1,
        trainings: [outlier],
      });
    },
    [],
  );

  const handleAccumulationModeChange = useCallback((value: string) => {
    const selectedMode = accumulationButtons.find((button) => button.value === value)?.value;
    if (selectedMode !== undefined) {
      setAccumulationMode(selectedMode);
    }
  }, []);

  const getTouchedBucket = useCallback(
    (event: GestureResponderEvent) => findBucketForTouch(buckets, accumulationMode, chartWidth, event.nativeEvent.locationX),
    [accumulationMode, buckets, chartWidth],
  );

  const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setChartWidth(nextWidth);
    }
  }, []);

  const handleChartPress = useCallback(
    (event: GestureResponderEvent) => {
      if (skipNextPressRef.current) {
        skipNextPressRef.current = false;
        return;
      }

      const touchedBucket = getTouchedBucket(event);
      if (!touchedBucket) {
        setSelectedBucketKey(null);
        return;
      }

      setSelectedBucketKey((currentBucketKey) => (currentBucketKey === touchedBucket.key ? null : touchedBucket.key));
    },
    [getTouchedBucket],
  );

  const handleChartLongPress = useCallback(
    (event: GestureResponderEvent) => {
      const touchedBucket = getTouchedBucket(event);
      if (!touchedBucket) {
        return;
      }

      skipNextPressRef.current = true;
      setSelectedBucketKey(touchedBucket.key);
      setBucketForEdit(touchedBucket);
    },
    [getTouchedBucket],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="training-length-screen">
      <Card style={styles.filterCard}>
        <Card.Content>
          <Text variant="titleMedium">Training Length</Text>
          <Text variant="bodyMedium" style={styles.modeLabel} testID="training-length-mode-label">
            Grouped by {accumulationMode}
          </Text>
          <SegmentedButtons value={accumulationMode} onValueChange={handleAccumulationModeChange} buttons={accumulationButtons.map((button) => ({...button}))} />
        </Card.Content>
      </Card>

      <DateRangePicker range={range} setRange={setRange} />

      <AnalyseStaleRangeBanner range={range} isEmpty={trainings.length === 0} lastDateOverride={lastCompletedTrainingDate ?? null} onApplyRange={setRange} testID="training-length-stale-range-banner" />

      {/* GH-458 (H6): the outliers are never silently dropped — their count is
          stated, they can be brought back into the scaling, and each one has a
          visible route to the editor instead of a hidden long press. */}
      {implausibleTrainings.length > 0 && (
        <Card style={styles.outlierCard} testID="training-length-outlier-notice">
          <Card.Content>
            <Text testID="training-length-outlier-count">
              {`${implausibleTrainings.length} training${implausibleTrainings.length === 1 ? '' : 's'} over ${formatTrainingLength(IMPLAUSIBLE_TRAINING_DURATION_MINUTES)} ${
                includeOutliers ? 'included' : 'hidden'
              }`}
            </Text>
            <Text variant="bodySmall" style={styles.mutedText} testID="training-length-outlier-explanation">
              A session that was never finished keeps counting, which distorts the scale and the averages.
            </Text>
            <View style={styles.outlierActions}>
              <Button mode="outlined" onPress={() => setIncludeOutliers((current) => !current)} testID="training-length-outlier-toggle">
                {includeOutliers ? 'Hide again' : 'Show anyway'}
              </Button>
              {implausibleTrainings.map((outlier) => (
                <Button key={outlier.key} mode="contained-tonal" icon="pencil" onPress={() => handleCorrectOutlier(outlier)} testID={`training-length-outlier-correct-${outlier.trainingId ?? outlier.key}`}>
                  {`Correct ${formatTrainingLengthDate(outlier.start)} (${formatTrainingLength(outlier.durationMinutes)})`}
                </Button>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {buckets.length === 0 ? (
        onlyOutliersInRange ? (
          // GH-458 round 3 (review #5): every completed training in the range is a
          // hidden outlier — "No completed trainings" would be wrong and hide the way out.
          <Card style={styles.emptyStateCard} testID="training-length-only-outliers-state">
            <Card.Title title="Only hidden outliers in this range" titleNumberOfLines={2} />
            <Card.Content>
              <Text style={styles.mutedText}>{`The only trainings here are over ${formatTrainingLength(IMPLAUSIBLE_TRAINING_DURATION_MINUTES)} and hidden from the chart.`}</Text>
              <Button mode="outlined" style={styles.emptyStateAction} onPress={() => setIncludeOutliers(true)} testID="training-length-only-outliers-show">
                Show hidden outliers
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.emptyStateCard} testID="training-length-empty-state">
            <Card.Title title="No completed trainings in this range" />
            <Card.Content>
              <Text style={styles.mutedText}>Pick a different date range to compare average completed training duration.</Text>
            </Card.Content>
          </Card>
        )
      ) : (
        <>
          <Card style={styles.chartCard}>
            <Card.Content>
              <Text style={styles.chartDescription}>Average completed training duration in minutes for each selected time bucket.</Text>
              <View style={styles.chartContainer} onLayout={handleChartLayout}>
                <BarChart
                  style={styles.chart}
                  drawGridBackground={false}
                  data={chartData}
                  drawValueAboveBar={false}
                  borderColor={processColor(theme.colors.outline)}
                  touchEnabled={false}
                  highlights={highlightedBars}
                  viewPortOffsets={{
                    left: Math.round(CHART_LEFT_PADDING * PixelRatio.get()),
                    top: Math.round(CHART_TOP_PADDING * PixelRatio.get()),
                    right: Math.round(CHART_RIGHT_PADDING * PixelRatio.get()),
                    bottom: Math.round(CHART_BOTTOM_PADDING * PixelRatio.get()),
                  }}
                  xAxis={{
                    timeUnit: 'DAYS',
                    valueFormatter: 'date',
                    valueFormatterPattern: getTrainingLengthAxisPattern(accumulationMode),
                    position: 'BOTTOM',
                    textColor: processColor(theme.colors.onBackground),
                    axisMinimum: chartDomain?.minX,
                    axisMaximum: chartDomain?.maxX,
                  }}
                  yAxis={{
                    left: {textColor: processColor(theme.colors.onBackground)},
                    right: {enabled: false},
                  }}
                  legend={{enabled: false}}
                  chartDescription={{text: ''}}
                />
                <Pressable style={styles.chartTouchTarget} testID="training-length-chart" onPress={handleChartPress} onLongPress={handleChartLongPress} />
              </View>
            </Card.Content>
          </Card>

          {selectedBucket && <TrainingLengthBucketDetails accumulationMode={accumulationMode} bucket={selectedBucket} trainingNameById={trainingNameById} onEditBucket={setBucketForEdit} />}
        </>
      )}
      <TrainingLengthEditDialog accumulationMode={accumulationMode} bucket={bucketForEdit} onDismiss={() => setBucketForEdit(null)} trainingNameById={trainingNameById} />
    </ScrollView>
  );
};

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
    outlierCard: {
      marginHorizontal: 12,
      marginTop: 8,
    },
    outlierActions: {
      marginTop: 12,
      gap: 8,
      alignItems: 'flex-start',
    },
    chartCard: {
      marginHorizontal: 12,
      marginTop: 8,
    },
    chartDescription: {
      marginBottom: 12,
      color: theme.colors.onSurfaceVariant,
    },
    chartContainer: {
      height: 320,
    },
    chart: {
      height: 320,
    },
    chartTouchTarget: {
      ...StyleSheet.absoluteFillObject,
    },
    mutedText: {
      color: theme.colors.onSurfaceVariant,
    },
    emptyStateAction: {
      marginTop: 12,
      alignSelf: 'flex-start',
    },
  });

export default TrainingLengthTab;
