import React, {useEffect, useState} from 'react';
import {processColor, ScrollView, StyleSheet, View} from 'react-native';
import {Chip, Text, useTheme} from 'react-native-paper';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {firstDayOfWeek, lastDayOfWeek, subtractMonths} from '../../utils/DateHelper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {ChartSelectEvent, LineChart, LineValue} from 'react-native-charts-wrapper';
import {RootStackParamList} from '../../routing/AnalyseRouter';
import TrainingElementPicker, {Accumulation} from '../../components/picker/elements/TrainingElementPicker';
import {useWorkoutsByIds} from '../../redux/Workout/use/useWorkoutsByIds';
import WorkoutView from '../../components/Workout/show/WorkoutDoneList';
import {Muscles} from '../../models/Muscles';
import {useExercisesForMuscles} from '../../redux/Exercises/use/useExercisesForMuscles';
import {Exercise} from '../../models/entities/Exercise';
import {Workout} from '../../models/entities/Workout';
import {generateTrend} from '../../utils/generateTrend';
import {ALL_METRICS, Metric} from '../../models/Metric';
import {buildMetricSeries} from '../../utils/AnalyseSeries';
import {AccumulationMode} from '../../models/AccumulationMode';
import AnalyseEmptyState from '../../components/analyse/AnalyseEmptyState';
import AnalyseStaleRangeBanner from '../../components/analyse/AnalyseStaleRangeBanner';
import {useLastWorkoutDate, useLastWorkoutDateForExercises} from '../../redux/Workout/use/useLastWorkoutDate';
import {ANALYSE_EXTENDED_RANGE_MONTHS, describeRange, rangeEndingAt, rangeEndingToday} from '../../utils/analyse-range';
import {getDateStringFromDate} from '../../utils/DateHelper';

const AnalyseGraphics = ({}: Props) => {
  function handleDataPointSelect(value: ChartSelectEvent) {
    let ids = value.nativeEvent?.data?.id
      ?.split(',')
      .filter((value: string) => value !== '')
      ?.map((value: string) => parseInt(value));
    setSelectedWorkoutIds(ids ?? []);
  }

  let now = new Date(Date.now());
  const [range, setRange] = useState(new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0)));
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<number[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([...ALL_METRICS]);
  const [accumulation, setAccumulation] = useState<Accumulation | undefined>(new Accumulation(AccumulationMode.SINGLE_DAY));
  const [exercise, setExercise] = useState<Exercise[]>([]);
  const [muscle, setMuscle] = useState<Muscles[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  let exercisesForMuscles = useExercisesForMuscles(muscle);
  let allWorkouts = useWorkoutsIn(range);
  const theme = useTheme();
  let selectedWorkout = useWorkoutsByIds(selectedWorkoutIds);

  useEffect(() => {
    setSelectedWorkoutIds([]);
    validateSelections();
  }, [exercise, metrics, accumulation, muscle]);

  const validateSelections = () => {
    let errors: string[] = [];
    if (metrics.length === 0) {
      errors.push('at least one Metric');
    }
    if (!accumulation) {
      errors.push('Accumulation Mode');
    }
    setErrorMessage(errors.length > 0 ? `Please select: ${errors.join(', ')}.` : null);
  };

  // GH-468: exercise / muscle are only a filter on the data basis. Without any
  // selection every logged set in the range is evaluated.
  const hasSelection = exercise.length > 0 || muscle.length > 0;
  const selectedExerciseIds = new Set([...exercise, ...exercisesForMuscles].map((it) => it.id));
  const includedWorkouts = hasSelection ? allWorkouts.filter((workout: Workout) => selectedExerciseIds.has(workout.exerciseId)) : allWorkouts;

  const seriesByMetric = metrics.map((it) => ({metric: it, values: buildMetricSeries(includedWorkouts, it, accumulation)}));
  const hasData = seriesByMetric.length > 0 && seriesByMetric[0].values.length > 0;

  // GH-458 (H3): each empty case gets its own named cause and a way forward.
  const isConfigured = metrics.length > 0 && !!accumulation;
  const selectionLabel = hasSelection ? [...exercise.map((it) => it.name), ...muscle.map(String)].join(', ') : 'any exercise';
  const selectionExerciseIds = Array.from(selectedExerciseIds).filter((id): id is number => id !== undefined);
  const lastWorkoutForSelection = useLastWorkoutDateForExercises(selectionExerciseIds);
  const lastWorkoutOverall = useLastWorkoutDate();
  const lastWorkout = hasSelection ? lastWorkoutForSelection : lastWorkoutOverall;

  const clearSelection = () => {
    setExercise([]);
    setMuscle([]);
  };

  const toggleMetric = (toggled: Metric) => {
    setMetrics(metrics.includes(toggled) ? metrics.filter((it) => it !== toggled) : ALL_METRICS.filter((it) => it === toggled || metrics.includes(it)));
  };

  return (
    <ScrollView
      style={{
        backgroundColor: theme.colors.background,
        display: 'flex',
        flex: 1,
      }}
    >
      <TrainingElementPicker
        exercise={exercise}
        setExercise={setExercise}
        accumulation={accumulation}
        setAccumulation={setAccumulation}
        muscle={muscle}
        setMuscle={setMuscle}
        dropdownLabel="Select Exercises, Muscles, Accumulation Mode"
      />
      {/* GH-468: every metric is shown by default; the chips double as legend
          (colour = line colour of the metric's own chart) and as the filter. */}
      <View style={styles.chipRow} testID="analyse-metric-chips">
        {ALL_METRICS.map((it) => (
          <Chip key={it} testID={`analyse-metric-chip-${it}`} style={styles.chip} selected={metrics.includes(it)} showSelectedOverlay onPress={() => toggleMetric(it)}>
            {it}
          </Chip>
        ))}
      </View>
      <DateRangePicker range={range} setRange={setRange} />

      <AnalyseStaleRangeBanner
        range={range}
        isEmpty={isConfigured ? !hasData : undefined}
        selectionExerciseIds={hasSelection ? selectionExerciseIds : undefined}
        onApplyRange={setRange}
        testID="analyse-chart-stale-range-banner"
      />

      {isConfigured &&
        hasData &&
        seriesByMetric.map(({metric: seriesMetric, values}) => {
          const color = processColor(METRIC_COLORS[seriesMetric]);
          return (
            <View key={seriesMetric} testID={`analyse-chart-${seriesMetric}`}>
              <View style={styles.chartTitleRow}>
                <View style={[styles.colorDot, {backgroundColor: METRIC_COLORS[seriesMetric]}]} />
                <Text variant="titleSmall">{`${seriesMetric} (${METRIC_AGGREGATION_LABEL[seriesMetric]})`}</Text>
              </View>
              <LineChart
                style={{
                  backgroundColor: theme.colors.background,
                  ...(seriesByMetric.length > 1 ? styles.chartSmall : styles.chart),
                }}
                marker={{
                  enabled: true,
                  markerColor: processColor(theme.colors.backdrop),
                  textSize: 15,
                  textColor: processColor(theme.colors.secondary),
                }}
                data={{
                  dataSets: [
                    {
                      config: {
                        color,
                        circleColor: color,
                        highlightEnabled: true,
                        lineWidth: 2,
                        drawCircleHole: false,
                        highlightColor: processColor(theme.colors.secondary),
                        circleRadius: 4,
                        mode: 'HORIZONTAL_BEZIER',
                        drawValues: false,
                      },
                      values,
                    },
                    {
                      config: {
                        color: processColor(theme.colors.tertiary),
                        drawCircles: false,
                        lineWidth: 1,
                        dashedLine: {lineLength: 15, spaceLength: 10},
                        mode: 'LINEAR',
                        drawValues: false,
                      },
                      values: generateTrend(values),
                    },
                  ],
                }}
                legend={{enabled: false}}
                xAxis={{
                  valueFormatter: 'date',
                  valueFormatterPattern: 'dd MMM',
                  position: 'BOTTOM',
                  textColor: processColor(theme.colors.onBackground),
                }}
                yAxis={{
                  left: {textColor: processColor(theme.colors.onBackground)},
                  right: {textColor: processColor(theme.colors.onBackground)},
                }}
                chartDescription={{text: ''}}
                onSelect={(value) => handleDataPointSelect(value)}
              />
            </View>
          );
        })}

      {!isConfigured && (
        <AnalyseEmptyState testID="analyse-chart-misconfigured" title="Nothing to chart yet" description={`${errorMessage} Open the selector above and pick what you want to see.`} />
      )}

      {isConfigured && !hasData && lastWorkout === undefined && (
        <AnalyseEmptyState
          testID="analyse-chart-never-trained"
          title={hasSelection ? `${selectionLabel} has never been trained` : 'Nothing trained yet'}
          description={`There is not a single logged set for ${selectionLabel}, so there is nothing to chart — no date range will change that.`}
          actions={hasSelection ? [{label: 'Choose something else', testID: 'analyse-chart-clear-selection', onPress: clearSelection}] : []}
        />
      )}

      {isConfigured && !hasData && lastWorkout !== undefined && (
        <AnalyseEmptyState
          testID="analyse-chart-empty-range"
          title={`No sets for ${selectionLabel} in this period`}
          description={`${selectionLabel} has no logged sets between ${describeRange(range)}. The last one was on ${getDateStringFromDate(lastWorkout)}.`}
          actions={[
            {
              label: `Extend to last ${ANALYSE_EXTENDED_RANGE_MONTHS} months`,
              testID: 'analyse-chart-extend-range',
              onPress: () => setRange(rangeEndingToday(ANALYSE_EXTENDED_RANGE_MONTHS)),
            },
            {
              label: `Jump to ${getDateStringFromDate(lastWorkout)}`,
              testID: 'analyse-chart-jump-to-last',
              onPress: () => setRange(rangeEndingAt(lastWorkout)),
            },
          ]}
        />
      )}

      {selectedWorkout && isConfigured && (
        <WorkoutView
          workoutIds={selectedWorkoutIds}
          highlightMode={metrics.length === 1 && metrics[0] !== Metric.FREQUENCY ? metrics[0] : undefined}
          editable={false}
        ></WorkoutView>
      )}
    </ScrollView>
  );
};

// One fixed colour per metric, so a metric keeps its colour whichever others are toggled.
const METRIC_COLORS: Record<Metric, string> = {
  [Metric.VOLUME]: '#1E88E5',
  [Metric.ONE_RM]: '#E53935',
  [Metric.SETS]: '#43A047',
  [Metric.REPS]: '#FB8C00',
  [Metric.MAX_INTENSITY]: '#8E24AA',
  [Metric.AVERAGE_INTENSITY]: '#00ACC1',
  [Metric.FREQUENCY]: '#6D4C41',
};

const METRIC_AGGREGATION_LABEL: Record<Metric, string> = {
  [Metric.VOLUME]: 'sum',
  [Metric.ONE_RM]: 'max',
  [Metric.SETS]: 'sum',
  [Metric.REPS]: 'sum',
  [Metric.MAX_INTENSITY]: 'max %',
  [Metric.AVERAGE_INTENSITY]: 'average %',
  [Metric.FREQUENCY]: 'training days',
};

const styles = StyleSheet.create({
  chart: {
    height: 350,
  },
  chartSmall: {
    height: 220,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 6,
  },
  chip: {
    marginVertical: 2,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export type Props = NativeStackScreenProps<RootStackParamList, 'AnalyseHome'>;

export default AnalyseGraphics;
