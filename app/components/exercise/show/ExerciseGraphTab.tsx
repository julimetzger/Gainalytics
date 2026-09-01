import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {LineValue} from 'react-native-charts-wrapper';
import {Chip, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';
import {Workout} from '../../../models/entities/Workout';
import {Metric} from '../../../models/Metric';
import {AccumulationMode} from '../../../models/AccumulationMode';
import {Accumulation} from '../../picker/elements/TrainingElementPicker';
import {handleAccumulationModeBatching} from '../../../utils/HandleAccumulationModeBatching';
import {calculateMetricValue} from '../../../utils/AnalyseUtils';
import {
  buildFrequencySeries,
  formatFrequencyCaption,
  formatFrequencySpan,
  frequencyQueryRange,
  FREQUENCY_ACCUMULATION_MODE,
  FREQUENCY_PERIOD_LABEL,
} from '../../../utils/FrequencySeries';
import {useWorkoutsIn} from '../../../redux/Workout/use/useWorkoutsIn';
import {Range} from '../../picker/date/DateRangePicker';
import ExerciseGraphCard from './ExerciseGraphCard';

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

  // Frequency is meaningless per day (it would be 1 on every training day), so it gets
  // its own weekly accumulation. The four existing graphs keep their daily summary.
  const frequencyAccumulation = useMemo(() => new Accumulation(FREQUENCY_ACCUMULATION_MODE), []);
  // The series covers the whole selected range, not just the weeks with data, so weeks
  // without a training are visible as zero. "All" starts at a sentinel date far before
  // any training, so there the series starts at the first week that has data.
  const frequencyWindow = useMemo(
    () => ({start: rangeKey === 'All' ? undefined : range.startDate, end: range.endDate}),
    [rangeKey, range],
  );
  // A range that starts in the middle of a week would cut that week short. The workouts of
  // the Frequency graph are therefore loaded from the Monday of that week on, so its first
  // point is a whole week.
  const frequencyRange = useMemo(() => frequencyQueryRange(range), [range]);
  const frequencyWorkoutsInRange = useWorkoutsIn(frequencyRange);
  const frequencyWorkouts = useMemo(
    () => frequencyWorkoutsInRange.filter((w: Workout) => w.exerciseId === exercise.id && w.sets.length > 0),
    [frequencyWorkoutsInRange, exercise.id],
  );
  const frequencyPoints = useMemo(
    () => buildFrequencySeries(frequencyWorkouts, frequencyAccumulation, frequencyWindow),
    [frequencyWorkouts, frequencyAccumulation, frequencyWindow],
  );
  const frequencyCaptions = useMemo(() => {
    const span = formatFrequencySpan(frequencyPoints);
    const latest = formatFrequencyCaption(frequencyPoints, range.endDate);
    return [
      ...(span === undefined ? [] : [{text: span, testID: 'graph-frequency-span'}]),
      ...(latest === undefined ? [] : [{text: latest, testID: 'graph-frequency-latest'}]),
    ];
  }, [frequencyPoints, range]);

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

      {METRICS.map((metric) => (
        <ExerciseGraphCard key={metric} title={metric} points={seriesByMetric[metric] ?? []} cardTestID={`graph-card-${metric}`} />
      ))}

      <ExerciseGraphCard
        title={Metric.FREQUENCY}
        subtitle={FREQUENCY_PERIOD_LABEL}
        points={frequencyPoints}
        captions={frequencyCaptions}
        cardTestID={`graph-card-${Metric.FREQUENCY}`}
        countSeries
      />
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
  bottomSpacer: {
    height: 12,
  },
});

export default ExerciseGraphTab;
