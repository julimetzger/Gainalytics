import React, {useMemo, useState} from 'react';
import {processColor, ScrollView, StyleSheet, View} from 'react-native';
import {LineChart, LineValue} from 'react-native-charts-wrapper';
import {Card, Chip, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from '../../../models/Metric';
import {AccumulationMode} from '../../../models/AccumulationMode';
import {Accumulation} from '../../picker/elements/TrainingElementPicker';
import {handleAccumulationModeBatching} from '../../../utils/HandleAccumulationModeBatching';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {generateTrend} from '../../../utils/generateTrend';
import {useWorkoutsIn} from '../../../redux/Workout/use/useWorkoutsIn';
import {Range} from '../../picker/date/DateRangePicker';

interface Props {
  exercise: Exercise;
}

const RANGE_OPTIONS = [
  {key: '1M', months: 1},
  {key: '3M', months: 3},
  {key: '6M', months: 6},
  {key: '1Y', months: 12},
  {key: 'All', months: 0},
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]['key'];

const METRICS: Metric[] = [Metric.ONE_RM, Metric.VOLUME, Metric.AVERAGE_INTENSITY, Metric.MAX_INTENSITY];

function rangeFor(key: RangeKey): Range {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (key === 'All') {
    return new Range(new Date(2000, 0, 1), end);
  }
  const months = RANGE_OPTIONS.find((r) => r.key === key)!.months;
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);
  return new Range(start, end);
}

const ExerciseGraphTab = ({exercise}: Props) => {
  const theme = useTheme();
  const [rangeKey, setRangeKey] = useState<RangeKey>('3M');
  const range = useMemo(() => rangeFor(rangeKey), [rangeKey]);
  const accumulation = useMemo(() => new Accumulation(AccumulationMode.SINGLE_DAY), []);

  const workoutsInRange = useWorkoutsIn(range);
  const exerciseWorkouts = useMemo(
    () => workoutsInRange.filter((w: Workout) => w.exerciseId === exercise.id && w.sets.length > 0),
    [workoutsInRange, exercise.id],
  );

  const seriesByMetric = useMemo(() => {
    const out: Record<string, LineValue[]> = {};
    METRICS.forEach((metric) => {
      const grouped = Array.from(
        exerciseWorkouts.reduce(handleAccumulationModeBatching(exerciseWorkouts, accumulation), new Map<string, Workout[]>()),
      ).map(([k, v]) => [k, v] as [string, Workout[]]);
      const points = grouped
        .map(([dateIso, workouts]) => {
          const sets = workouts.flatMap((w) => w.sets);
          const value = calculateMetricValue(sets, metric, workouts.length) ?? 0;
          return {
            x: new Date(dateIso).getTime(),
            y: value,
            marker: value.toFixed(2),
          } as LineValue;
        })
        .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
      out[metric] = points;
    });
    return out;
  }, [exerciseWorkouts, accumulation]);

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: theme.colors.background}]}
      keyboardShouldPersistTaps="handled"
      testID="exercise-graph-tab"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rangePill}
        keyboardShouldPersistTaps="handled"
      >
        {RANGE_OPTIONS.map((opt) => (
          <Chip
            key={opt.key}
            mode={rangeKey === opt.key ? 'flat' : 'outlined'}
            selected={rangeKey === opt.key}
            onPress={() => setRangeKey(opt.key)}
            style={styles.rangeChip}
            testID={`graph-range-${opt.key}`}
          >
            {opt.key}
          </Chip>
        ))}
      </ScrollView>

      {METRICS.map((metric) => {
        const points = seriesByMetric[metric] ?? [];
        return (
          <Card style={styles.chartCard} key={metric}>
            <Card.Title title={metric} testID={`graph-card-${metric}`} />
            <Card.Content>
              {points.length === 0 ? (
                <Text style={styles.emptyText}>No data in this range.</Text>
              ) : (
                <LineChart
                  style={[styles.chart, {backgroundColor: theme.colors.background}]}
                  marker={{
                    enabled: true,
                    markerColor: processColor(theme.colors.backdrop),
                    textSize: 13,
                    textColor: processColor(theme.colors.secondary),
                  }}
                  data={{
                    dataSets: [
                      {
                        config: {
                          color: processColor(theme.colors.primary),
                          circleColor: processColor(theme.colors.primary),
                          highlightEnabled: true,
                          lineWidth: 2,
                          drawCircleHole: false,
                          highlightColor: processColor(theme.colors.secondary),
                          circleRadius: 3,
                          mode: 'HORIZONTAL_BEZIER',
                          drawValues: false,
                        },
                        values: points,
                      },
                      {
                        config: {
                          color: processColor(theme.colors.tertiary),
                          drawCircles: false,
                          lineWidth: 1,
                          dashedLine: {lineLength: 12, spaceLength: 8},
                          mode: 'LINEAR',
                          drawValues: false,
                        },
                        values: generateTrend(points),
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
                />
              )}
            </Card.Content>
          </Card>
        );
      })}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  rangePill: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  rangeChip: {
    marginRight: 6,
  },
  chartCard: {
    marginHorizontal: 8,
    marginBottom: 12,
  },
  chart: {
    height: 220,
  },
  emptyText: {
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 12,
  },
});

export default ExerciseGraphTab;
