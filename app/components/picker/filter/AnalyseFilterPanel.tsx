import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, IconButton, Surface, Text, useTheme} from 'react-native-paper';
import {Range} from '../date/DateRangePicker';
import DateRangeDialog from '../date/DateRangeDialog';
import {Accumulation} from '../../../models/Accumulation';
import {AccumulationMode} from '../../../models/AccumulationMode';
import {Exercise} from '../../../models/entities/Exercise';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Metric} from '../../../models/Metric';
import {Muscles} from '../../../models/Muscles';
import {useAllTrainingsPlans} from '../../../redux/Training/use/useAllTrainingsPlans';
import {useAvailableMuscles} from '../../../redux/settings/use/useMuscles';
import {formatGroupByAndMetrics, formatRangeLabel, formatSelectionSummary} from '../../../utils/filter-panel';
import RangeStepper from './RangeStepper';
import RangeLengthChips from './RangeLengthChips';
import GroupBySelector from './GroupBySelector';
import MetricChips from './MetricChips';
import ExerciseQuickPicks from './ExerciseQuickPicks';
import MuscleGrid from './MuscleGrid';
import FilterSection from './FilterSection';
import ExerciseSearchSheet from './ExerciseSearchSheet';

interface AnalyseFilterPanelProps {
  exercise: Exercise[];
  setExercise: (exercises: Exercise[]) => void;
  /** Each optional pair below shows its section only when the setter is passed. */
  muscle?: Muscles[];
  setMuscle?: (muscles: Muscles[]) => void;
  range?: Range;
  setRange?: (range: Range) => void;
  accumulation?: Accumulation;
  setAccumulation?: (accumulation: Accumulation | undefined) => void;
  metrics?: Metric[];
  setMetrics?: (metrics: Metric[]) => void;
  initiallyExpanded?: boolean;
}

/**
 * GH-642: the Analyse filter. Collapsed it is a card with up to three lines
 * (period · selection · group by and metrics) that steps the period on swipe or
 * arrow and expands on tap; expanded it shows range length, group by, metrics,
 * exercises and muscles as separate sections. Every change applies at once.
 */
const AnalyseFilterPanel = (props: AnalyseFilterPanelProps) => {
  const {exercise, setExercise, muscle, setMuscle, range, setRange, accumulation, setAccumulation, metrics, setMetrics, initiallyExpanded = false} = props;
  const theme = useTheme();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const trainingsPlans = useAllTrainingsPlans();
  const availableMuscles = useAvailableMuscles();
  const steppableRange = setRange ? range : undefined;

  // Re-sync a Micro grouping when its plan changes in the store. Never call .find() in the
  // dep array — it creates a new object on every render and loops (GH-127).
  const syncedPlan = trainingsPlans.find((tp: TrainingsPlan) => tp.id === accumulation?.trainingsPlan?.id);
  useEffect(() => {
    if (accumulation?.accumulationMode === AccumulationMode.TRAINING_MICROCYCLE && setAccumulation && syncedPlan) {
      setAccumulation(Accumulation.fromTrainingsPlan(syncedPlan));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedPlan]);

  const groupLine = formatGroupByAndMetrics(setAccumulation ? accumulation : undefined, setMetrics ? metrics ?? [] : undefined);

  return (
    <Surface style={[styles.panel, {borderRadius: theme.roundness * 3}]} elevation={1} testID="filter-panel">
      {!expanded ? (
        <RangeStepper range={steppableRange} setRange={setRange} onPress={() => setExpanded(true)} testID="filter-panel-card">
          <View style={styles.card}>
            <View style={styles.cardLines}>
              {steppableRange && (
                <Text variant="titleSmall" testID="filter-range-label">
                  {formatRangeLabel(steppableRange)}
                </Text>
              )}
              <Text variant="bodyMedium" numberOfLines={2} testID="filter-selection-summary">
                {formatSelectionSummary(exercise, muscle ?? [])}
              </Text>
              {groupLine.length > 0 && (
                <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}} testID="filter-groupby-summary">
                  {groupLine}
                </Text>
              )}
            </View>
            <Icon source="chevron-down" size={24} />
          </View>
        </RangeStepper>
      ) : (
        <View style={styles.expanded}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              {steppableRange ? (
                <RangeStepper range={steppableRange} setRange={setRange} testID="filter-range-row">
                  <Text variant="titleSmall" style={styles.center} testID="filter-range-label">
                    {formatRangeLabel(steppableRange)}
                  </Text>
                </RangeStepper>
              ) : (
                <Text variant="titleSmall" style={styles.title} testID="filter-panel-title">
                  Filter
                </Text>
              )}
            </View>
            <IconButton testID="filter-panel-collapse" icon="chevron-up" accessibilityLabel="Collapse filter" onPress={() => setExpanded(false)} style={styles.noMargin} />
          </View>
          {steppableRange && setRange && <RangeLengthChips range={steppableRange} setRange={setRange} onCustom={() => setCustomOpen(true)} />}
          {setAccumulation && (
            <FilterSection title="Group by" testID="filter-groupby-section">
              <GroupBySelector accumulation={accumulation} setAccumulation={setAccumulation} trainingsPlans={trainingsPlans} />
            </FilterSection>
          )}
          {setMetrics && (
            <FilterSection title="Metrics" testID="filter-metrics-section">
              <MetricChips metrics={metrics ?? []} setMetrics={setMetrics} />
            </FilterSection>
          )}
          <FilterSection title={`Exercises (${exercise.length})`} testID="filter-exercise-section" action={{label: 'Search all', icon: 'magnify', testID: 'filter-exercise-search-all', onPress: () => setSearchOpen(true)}}>
            <ExerciseQuickPicks selected={exercise} setSelected={setExercise} />
          </FilterSection>
          {setMuscle && (
            <FilterSection
              title={`Muscles (${muscle?.length ?? 0})`}
              testID="filter-muscle-section"
              action={{label: 'Clear', testID: 'filter-muscle-clear', onPress: () => setMuscle([]), disabled: (muscle?.length ?? 0) === 0}}
            >
              <MuscleGrid available={availableMuscles} selected={muscle ?? []} setSelected={setMuscle} />
            </FilterSection>
          )}
        </View>
      )}
      <ExerciseSearchSheet visible={searchOpen} onDismiss={() => setSearchOpen(false)} selected={exercise} onChange={setExercise} />
      {range && setRange && <DateRangeDialog visible={customOpen} range={range} onDismiss={() => setCustomOpen(false)} onSave={(startDate, endDate) => setRange(new Range(startDate, endDate))} />}
    </Surface>
  );
};

export default AnalyseFilterPanel;

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 8,
    marginVertical: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  cardLines: {
    flex: 1,
    gap: 2,
  },
  expanded: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
    paddingVertical: 12,
  },
  title: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  noMargin: {
    margin: 0,
  },
});
